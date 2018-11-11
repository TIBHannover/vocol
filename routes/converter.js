var express = require('express');
var bodyParser = require('body-parser');
var shell = require('shelljs');
var exec = require('child_process').exec;
var router = express.Router();
var fs = require('fs');
var app = express();
var jsonfile = require('jsonfile');
var http = require('http');
var path = require('path');
var url = require('url');
var spawn = require('child_process').spawn;
var request = require('request');
var querystring = require('querystring');
var endpointPortNumber = process.argv.slice(2)[1] || 3030;
var endpoint = 'http:\//localhost:' + endpointPortNumber.toString() +
  '/dataset/sparql';

// to re-write the namedgraph lists to be added to the query
var namedGraphsString4Qurery = "";

// query to get RDFS_Concepts
var RDFSConceptsQuery = function(namedGraphsString) {
  return ("PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> " +
    " PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> " +
    " PREFIX owl:  <http://www.w3.org/2002/07/owl#> " +
    " PREFIX foaf: <http://xmlns.com/foaf/0.1/> " +
    " PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#> " +
    " PREFIX skos: <http://www.w3.org/2004/02/skos/core#> " +
    " SELECT DISTINCT ?concept ?RDFType ?g " +
    namedGraphsString +
    " WHERE {  GRAPH ?g { ?s ?p ?o }  GRAPH ?g { {" +
    " ?concept rdfs:subClassOf ?p" + "  OPTIONAL {?concept a ?RDFType.} " +
    " Filter(!bound(?RDFType))" + "}" + "UNION{" +
    " ?concept a ?RDFType . " +
    "           OPTIONAL {?concept ?p ?o.}" +
    " FILTER (!contains(str(?RDFType), \"skos/core#\"))" +
    " FILTER (contains(str(?RDFType), \"owl#\")||contains(str(?RDFType), \"22-rdf-syntax-ns#\")||contains(str(?RDFType),\"rdf-schema#\" ))"

    +
    " MINUS{?concept a owl:NamedIndividual  ." +
    " }" +
    " MINUS{?concept a owl:Thing ." +
    " }}}}");
}

var RDFSObjectsQuery = function(namedGraphsString) {

  return ("PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> " +
    "PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> " +
    "PREFIX owl:  <http://www.w3.org/2002/07/owl#>  " +
    "PREFIX foaf: <http://xmlns.com/foaf/0.1/>  " +
    "PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>  " +
    "PREFIX skos: <http://www.w3.org/2004/02/skos/core#> " +
    "SELECT Distinct ?o ?g " +
    namedGraphsString +
    " WHERE { GRAPH ?g { ?s ?p ?o }  GRAPH ?g {" +
    "?s ?p ?o. FILTER (!isLiteral(?o))   FILTER(!isBlank(?o))" + "MINUS " +
    "  { ?s ?p ?o. FILTER (!isLiteral(?o))   FILTER(!isBlank(?o)) FILTER(regex(str(?p), \"skos/core#\" )) }" +
    "}}");

}

var individualsQuery = function(namedGraphsString) {
  return ("PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>" +
    " PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>" +
    " PREFIX owl:  <http://www.w3.org/2002/07/owl#>" +
    " PREFIX skos: <http://www.w3.org/2004/02/skos/core#>" +
    " SELECT DISTINCT ?s ?RDFType ?g  " +
    namedGraphsString +
    " WHERE {  GRAPH ?g { ?s ?p ?o }  GRAPH ?g { {" +
    " ?s a ?RDFType ; ?p ?o." +
    " FILTER (!contains(str(?RDFType), \"owl#\"))" +
    " FILTER (!contains(str(?RDFType), \"rdf-schema#\"))" +
    " FILTER (!contains(str(?RDFType), \"22-rdf-syntax-ns#\"))" +
    " FILTER (!contains(str(?RDFType), \"skos/core#\"))" +
    " FILTER (!contains(str(?p), \"subClassOf\"))" +
    " FILTER (!contains(str(?p), \"subPropertyOf\"))" +
    " }" +
    " UNION{?s a ?RDFType ." +
    "  FILTER (contains(str(?RDFType), \"owl#NamedIndividual\"))" +
    " }" +
    " UNION{?s a ?RDFType ." +
    "     FILTER (contains(str(?RDFType), \"owl#Thing\"))" +
    " }}}");
}

var childParentRelationQuery = function(namedGraphsString) {
  return ("PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>  " +
    " SELECT  ?classChild ?classParent   " + namedGraphsString +
    "  WHERE {" +
    " ?classChild rdfs:subClassOf  ?classParent . " +
    " FILTER(!isBlank(?classParent)) " +
    " FILTER(!isBlank(?classChild))" +
    " }");
}

// query to find all the named graphs in SPARQL-endpoint
var allNamedGraphsQuery = 'SELECT DISTINCT ?g ' +
  'WHERE {' +
  '  GRAPH ?g { ?s ?p ?o }' +
  '}';

function execQuery(currentQueryString, caller) {
  request.get({
    headers: {
      'Accept': 'application/sparql-results+json;charset=UTF-8'
    },
    url: endpoint + '?query=' + querystring.escape(currentQueryString)
  }, function(error, response, data) {
    if (!error && response.statusCode == 200) {
      // Show the HTML for the Google homepage.
      if (data != null) {
        data = JSON.parse(data)
        // callback to the caller function to deliver the result after coming of response
        if (caller == "RDFObjects")
          generateRDFObjects("", data.results.bindings)
        else if (caller == "RDFConcepts")
          generateRDFConcepts("", data.results.bindings)
        else if (caller == "Individuals")
          generateIndividuals("", data.results.bindings)
        else if (caller == "childParentRelationQuery")
          generateChildParentRelation("", data.results.bindings)
      }
    } else {
      console.log(response.statusCode)
      console.warn(error);
    }
  });
}


function trim(URI) {
  var conceptArray = [];
  var conceptTrimmed = "";
  if (URI.includes("/")) {
    conceptArray = URI.split("/");
    if (conceptArray != null && conceptArray.length > 0) {
      conceptTrimmed = conceptArray[conceptArray.length - 1];
    }
  }
  if (conceptTrimmed.includes("#")) {
    conceptArray = URI.split("#");
    if (conceptArray != null && conceptArray.length > 0) {
      conceptTrimmed = conceptArray[conceptArray.length - 1];

    }

  }
  return conceptTrimmed;
}

function trimInstance(URI) {
  var conceptArray = [];
  var conceptTrimmed = "";
  if (URI.endsWith("/"))
    URI = URI.substring(0, URI.length - 1);
  if (URI.includes("/")) {
    conceptArray = URI.split("/");
    if (conceptArray != null && conceptArray.length > 0) {
      conceptTrimmed = conceptArray[conceptArray.length - 1];
    }
  }
  if (conceptTrimmed.includes("#")) {
    conceptArray = URI.split("#");
    if (conceptArray != null && conceptArray.length > 0) {
      conceptTrimmed = conceptArray[conceptArray.length - 1];
    }
  }
  return conceptTrimmed;
}

function replaceWithRDFType(RDFType) {
  var conceptArray = [];
  var RDFTypeTrimmed = "";
  if (RDFType.includes("skos/core#")) {
    conceptArray = RDFType.split("#");
    if (conceptArray != null && conceptArray.length > 0) {
      RDFTypeTrimmed = conceptArray[conceptArray.length - 1];
      return "skos:" + RDFTypeTrimmed.substring(RDFTypeTrimmed.lastIndexOf('#') +
          1);
    }
  } else if (RDFType.includes("/")) {
    conceptArray = RDFType.split("/");
    if (conceptArray != null && conceptArray.length > 0) {
      RDFTypeTrimmed = conceptArray[conceptArray.length - 1];
    }
  }
  if (RDFTypeTrimmed.indexOf("Class") >= 0 && RDFTypeTrimmed.indexOf("owl") >=
    0)
    return "owl:Class";
  else if (RDFTypeTrimmed.indexOf("Class") >= 0 && RDFTypeTrimmed.indexOf(
      "rdf-schema") >= 0)
    return "rdfs:Class";
  else if (RDFTypeTrimmed.indexOf("owl") >= 0)
    return "owl:" + RDFTypeTrimmed.substring(RDFTypeTrimmed.lastIndexOf('#') +
        1);
  else if (RDFTypeTrimmed.indexOf("rdf-schema") >= 0)
    return "rdfs:" + RDFTypeTrimmed.substring(RDFTypeTrimmed.lastIndexOf('#') +
        1);
  else if (RDFTypeTrimmed.indexOf("22-rdf-syntax-ns") >= 0)
    return "rdf:" + RDFTypeTrimmed.substring(RDFTypeTrimmed.lastIndexOf('#') +
        1);
  else if (RDFType.includes("foaf"))
    return "foaf:" + trim(RDFType);
  else
    return trim(RDFType);
}

var childParentValues = [];
// convert query_result of RDFSConcepts to JSON to be used in documentation
function generateRDFConcepts(fromInQuery, result) {
  if (result) {
    if (result[0] != null) {
      var JSONRDFObjectArrary = [];
      for (var k in result) {
        var nodeParnet = "";
        // find perant of child if exists
        childParentValues.forEach(function(element, index) {
          if (element['child'] === result[k]["concept"].value) {
            nodeParnet = replaceWithRDFType(element['parent']);
          }
        })

        var JSONRDFObject = {
          "parent": nodeParnet,
          "concept": trimInstance(result[k]["concept"].value),
          "URI": result[k]["concept"].value,
          "RDFType": replaceWithRDFType(result[k]["RDFType"].value),
          "fileName": result[k]["g"].value.substring(result[k]["g"].value.lastIndexOf(
              '/') + 1, result[k]["g"].value[result[k]["g"].value.length])
        };
        JSONRDFObjectArrary.push(JSONRDFObject);
      }
      const file = 'jsonDataFiles/RDFSConcepts.json'
      jsonfile.writeFileSync(file, JSONRDFObjectArrary, {
        spaces: 2
      })
    }

  } else {
    generateChildParentRelation(fromInQuery.replace(/named/g, ''))
    execQuery(RDFSConceptsQuery(fromInQuery), "RDFConcepts");
    //execQuery(childParentRelationQuery(fromInQuery.replace(/named/g, '')));

  }
}

// convert query_result of RDFSConcepts to JSON to be used in documentation
function generateChildParentRelation(fromInQuery, result) {
  if (result) {
    var JSONRDFObjectArrary = [];
    for (var k in result) {
      var JSONRDFObject = {
        "parent": result[k]["classParent"].value,
        "child": result[k]["classChild"].value
      };
      JSONRDFObjectArrary.push(JSONRDFObject);
    }
    childParentValues = JSONRDFObjectArrary;
  } else {
    console.log(fromInQuery);
    execQuery(childParentRelationQuery(fromInQuery),
      "childParentRelationQuery");
  }
}

// convert query_result of RDFObjects to JSON to be used in documentation
function generateRDFObjects(fromInQuery, result) {
  if (result) {
    var JSONRDFObjectArrary = [];
    for (var k in result) {
      var JSONRDFObject = {
        "object": replaceWithRDFType(result[k]["o"].value),
        "URI": result[k]["o"].value
      };
      JSONRDFObjectArrary.push(JSONRDFObject);
    }
    console.log(JSONRDFObjectArrary);
    const file = 'jsonDataFiles/RDFSObjects.json'
    jsonfile.writeFileSync(file, JSONRDFObjectArrary, {
      spaces: 2
    })

  } else
    execQuery(RDFSObjectsQuery(fromInQuery), "RDFObjects");
}

// convert query_result of Individuals to JSON to be used in documentation
function generateIndividuals(fromInQuery, result) {
  if (result) {
    if (result[0] != null) {
      var JSONRDFObjectArrary = [];
      for (var k in result) {
        var JSONRDFObject = {
          "subject": trimInstance(result[k]["s"].value),
          "subjectURI": result[k]["s"].value,
          "RDFType": replaceWithRDFType(result[k]["RDFType"].value),
          "fileName": result[k]["g"].value.substring(result[k]["g"].value.lastIndexOf(
              '/') + 1, result[k]["g"].value[result[k]["g"].value.length])
        };
        JSONRDFObjectArrary.push(JSONRDFObject);
      }
      const file = 'jsonDataFiles/OWLIndividiuals.json'
      jsonfile.writeFileSync(file, JSONRDFObjectArrary, {
        spaces: 2
      })

    }
  } else
    execQuery(individualsQuery(fromInQuery), "Individuals");
}


router.get('/', function(req, res) {
  // query to fuseki to getAllNamedGraphs
  request.get({
    headers: {
      'Accept': 'application/sparql-results+json;charset=UTF-8'
    },
    url: endpoint + '?query=' + allNamedGraphsQuery
  }, function(error, response, data) {
    if (!error && response.statusCode == 200) {
      var list = [],
        namedGraphsString4Qurery = "";
      // Show the HTML for the Google homepage.
      if (data != null) {
        data = JSON.parse(data)

        var graphs = data.results.bindings;
        //console.log(graphs);
        if (graphs[0] != null) {
          for (var i = 0; i < graphs.length; i++) {
            list.push(graphs[i]["g"].value);
          }
          var namedGraphsList4Qurery = [];
          for (var i in list) {
            // filter with the current ontology name and branchName
            if (list[i].includes(req.url.split("?")[1].split(":")[0]) &&
              list[i].includes(req.url.split("?")[1].split(":")[1]))
              namedGraphsString4Qurery += "from named <" + list[i] +
                ">\n";
          }
          //Gererate JSONFile of RDFS_Concepts
          generateRDFConcepts(namedGraphsString4Qurery);
          //Gererate JSONFile of RDFS_Objects
          generateRDFObjects(namedGraphsString4Qurery);
          //Gererate JSONFile of Individuals
          generateIndividuals(namedGraphsString4Qurery);
          //Gererate JSONFile of SKOS_Concepts
          //generateSKOSConcepts(namedGraphsString4Qurery);
          //Gererate JSONFile of SKOS_Objects
          //generateSKOSObjects(namedGraphsString4Qurery);


        }
      }
    } else {
      console.log(response.statusCode)
      console.warn(error);
      return null;
    }
  });

}); // end of router.get

module.exports = router;
