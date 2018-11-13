var express = require('express');
var app = express();
var router = express.Router();
var fs = require('fs');
var request = require('request');
var shell = require('shelljs');
var bodyParser = require('body-parser');
var exec = require('child_process').exec;
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
var RDFConceptsJson = [];
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

function execQuery(currentQueryString, caller, childParentValues) {
  return new Promise(function(resolve, reject) {
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
          //generateRDFObjects("", data.results.bindings)
          {
            if (data.results.bindings) {
              var JSONRDFObjectArrary = [];
              for (var k in data.results.bindings) {
                var JSONRDFObject = {
                  "object": replaceWithRDFType(data.results.bindings[
                    k]["o"]
                    .value),
                  "URI": data.results.bindings[k]["o"].value
                };
                JSONRDFObjectArrary.push(JSONRDFObject);
              }
              resolve(JSONRDFObjectArrary);
            }
          } else if (caller == "RDFConcepts") {
            if (data.results.bindings) {
              if (data.results.bindings[0] != null) {
                var JSONRDFObjectArrary = [];
                console.log("childParentValues");
                console.log(childParentValues);
                for (var k in data.results.bindings) {
                  var nodeParnet = "";
                  // find perant of child if exists
                  if (childParentValues) {


                    childParentValues.forEach(function(element, index) {
                      if (element['child'] === data.results.bindings[
                          k]["concept"].value) {
                        nodeParnet = replaceWithRDFType(element[
                          'parent']);
                      }
                    })
                  }

                  var JSONRDFObject = {
                    "parent": nodeParnet,
                    "concept": trimInstance(data.results.bindings[k][
                      "concept"
                    ].value),
                    "URI": data.results.bindings[k]["concept"].value,
                    "RDFType": replaceWithRDFType(data.results.bindings[
                      k]["RDFType"]
                      .value),
                    "fileName": data.results.bindings[k]["g"].value.substring(
                      data.results.bindings[
                        k]["g"].value.lastIndexOf(
                        '/') + 1, data.results.bindings[k]["g"].value[
                        data.results.bindings[k][
                          "g"
                        ].value.length])
                  };
                  if (JSONRDFObject.parent != "") {
                    console.log(JSONRDFObject);
                  }
                  JSONRDFObjectArrary.push(JSONRDFObject);
                }
                resolve(JSONRDFObjectArrary);
              }
            }
          } else if (caller == "Individuals") {
            if (data.results.bindings) {
              if (data.results.bindings[0] != null) {
                var JSONRDFObjectArrary = [];
                for (var k in data.results.bindings) {
                  var JSONRDFObject = {
                    "subject": trimInstance(data.results.bindings[k][
                      "s"
                    ].value),
                    "subjectURI": data.results.bindings[k]["s"].value,
                    "RDFType": replaceWithRDFType(data.results.bindings[
                      k]["RDFType"].value),
                    "fileName": data.results.bindings[k]["g"].value.substring(
                      data.results.bindings[k]["g"].value.lastIndexOf(
                        '/') + 1, data.results.bindings[k]["g"].value[
                        data.results.bindings[k]["g"].value.length]
                    )
                  };
                  JSONRDFObjectArrary.push(JSONRDFObject);
                }
                resolve(JSONRDFObjectArrary);
              }
            }
          } else if (caller == "childParent") {
            if (data.results.bindings) {
              var JSONRDFObjectArrary = [];
              for (var k in data.results.bindings) {
                var JSONRDFObject = {
                  "parent": data.results.bindings[k]["classParent"].value,
                  "child": data.results.bindings[k]["classChild"].value
                };
                JSONRDFObjectArrary.push(JSONRDFObject);
              }
              resolve(JSONRDFObjectArrary);
            }
          }
        }
      } else {
        console.log(response.statusCode)
        console.warn(error);
        reject(error);
      }
    });
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

//var childParentValues = [];
// convert query_result of RDFSConcepts to JSON to be used in documentation
// async function generateRDFConcepts(fromInQuery, result) {
//   if (result) {
//     if (result[0] != null) {
//       var JSONRDFObjectArrary = [];
//       for (var k in result) {
//         var nodeParnet = "";
//         // find perant of child if exists
//         childParentValues.forEach(function(element, index) {
//           if (element['child'] === result[k]["concept"].value) {
//             nodeParnet = replaceWithRDFType(element['parent']);
//           }
//         })
//
//         var JSONRDFObject = {
//           "parent": nodeParnet,
//           "concept": trimInstance(result[k]["concept"].value),
//           "URI": result[k]["concept"].value,
//           "RDFType": replaceWithRDFType(result[k]["RDFType"].value),
//           "fileName": result[k]["g"].value.substring(result[k]["g"].value.lastIndexOf(
//               '/') + 1, result[k]["g"].value[result[k]["g"].value.length])
//         };
//         JSONRDFObjectArrary.push(JSONRDFObject);
//       }
//       return JSONRDFObjectArrary;
//
//     // const file = 'jsonDataFiles/RDFSConcepts.json'
//     // jsonfile.writeFileSync(file, JSONRDFObjectArrary, {
//     //   spaces: 2
//     // })
//     }
//
//   } else {
//
//     await generateChildParentRelation(fromInQuery.replace(/named/g, ''))
//     await execQuery(RDFSConceptsQuery(fromInQuery), "RDFConcepts");
//     //execQuery(childParentRelationQuery(fromInQuery.replace(/named/g, '')));
//
//   }
// }

// convert query_result of RDFSConcepts to JSON to be used in documentation
// function generateChildParentRelation(fromInQuery, result) {
//   if (result) {
//     var JSONRDFObjectArrary = [];
//     for (var k in result) {
//       var JSONRDFObject = {
//         "parent": result[k]["classParent"].value,
//         "child": result[k]["classChild"].value
//       };
//       JSONRDFObjectArrary.push(JSONRDFObject);
//     }
//     childParentValues = JSONRDFObjectArrary;
//   } else {
//     console.log(fromInQuery);
//     execQuery(childParentRelationQuery(fromInQuery),
//       "childParentRelationQuery");
//   }
// }

// convert query_result of RDFObjects to JSON to be used in documentation
// function generateRDFObjects(fromInQuery, result) {
//   if (result) {
//     var JSONRDFObjectArrary = [];
//     for (var k in result) {
//       var JSONRDFObject = {
//         "object": replaceWithRDFType(result[k]["o"].value),
//         "URI": result[k]["o"].value
//       };
//       JSONRDFObjectArrary.push(JSONRDFObject);
//     }
//     console.log(JSONRDFObjectArrary);
//     return JSONRDFObjectArrary;
//   } else
//     execQuery(RDFSObjectsQuery(fromInQuery), "RDFObjects");
// }

// convert query_result of Individuals to JSON to be used in documentation
// function generateIndividuals(fromInQuery, result) {
//   if (result) {
//     if (result[0] != null) {
//       var JSONRDFObjectArrary = [];
//       for (var k in result) {
//         var JSONRDFObject = {
//           "subject": trimInstance(result[k]["s"].value),
//           "subjectURI": result[k]["s"].value,
//           "RDFType": replaceWithRDFType(result[k]["RDFType"].value),
//           "fileName": result[k]["g"].value.substring(result[k]["g"].value.lastIndexOf(
//               '/') + 1, result[k]["g"].value[result[k]["g"].value.length])
//         };
//         JSONRDFObjectArrary.push(JSONRDFObject);
//       }
//       return JSONRDFObjectArrary
//     }
//   } else
//     execQuery(individualsQuery(fromInQuery), "Individuals");
// }

function uniquefileNames(array) {
  var out = [];
  var sl = array;

  for (var i = 0, l = sl.length; i < l; i++) {
    var unique = true;
    for (var j = 0, k = out.length; j < k; j++) {
      if (sl[i] !== undefined)
        if (sl[i].toLowerCase() === out[j].toLowerCase()) {
          unique = false;
      }
    }
    if (unique) {
      out.push(sl[i]);
    }
  }
  return out;
}

// sort name of files
function SortFiles(x, y) {
  return ((x.toLowerCase() == y.toLowerCase()) ? 0 : ((x.toLowerCase() >
  y.toLowerCase()) ? 1 : -1));
}


var treeData = [];
// loop to find the classes
function SortConcepts(x, y) {
  return ((x.concept.toLowerCase() == y.concept.toLowerCase()) ?
    0 : ((x.concept.toLowerCase() > y.concept.toLowerCase()) ?
      1 : -1));
}

function uniqueConcepts(array) {
  var out = [];
  var sl = array;

  for (var i = 0, l = sl.length; i < l; i++) {
    var unique = true;
    for (var j = 0, k = out.length; j < k; j++) {
      if (sl[i] !== undefined)
        if (sl[i].concept.toLowerCase() === out[j].concept.toLowerCase()) {
          unique = false;
      }
    }
    if (unique) {
      out.push(sl[i]);
    }
  }

  return out;
}

// filter external classes
function filterExternalConcept(RDFObjects) {
  var out = [];
  var data = [];
  for (var i = 0, j = 0, l = RDFObjects.length; i < l; i++) {
    if (typeof (RDFObjects[i].object) != "undefined") {
      data[j] = RDFObjects[i].object;
      j++;
    }
  }
  for (var i = 0, l = data.length; i < l; i++) {
    var unique = true;
    for (var j = 0, k = out.length; j < k; j++) {
      if (data[i] === out[j])
        unique = false;
    }
    if (unique) {
      out.push(data[i]);
    }
  }
  return out;
}

// translation of concept to URI
function findURI(array, item) {
  var i = 0;
  while (array[i].concept != item) {
    i++;
  }
  return array[i].URI;
}


router.get('/', function(req, res) {
  if (!req.session.isAuthenticated && req.app.locals.authRequired)
    res.render('login', {
      title: 'login'
    });
  else {

    //////////////////////////////////////////////////////////
    ////  Start working for namedGraphsString4Qurery
    //////////////////////////////////////////////////////////
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
              if (list[i].includes("ins3") &&
                list[i].includes("develop"))
                namedGraphsString4Qurery += "from named <" + list[i] +
                  ">\n";
            }
            // console.log('1')
            // execQuery(RDFSObjectsQuery(namedGraphsString4Qurery),
            //   "RDFObjects");
            // console.log('2')
            //
            // (async() => {
            //   console.log('1')
            //   await execQuery(RDFSObjectsQuery(
            //     namedGraphsString4Qurery),
            //     "RDFObjects");
            //   console.log('2')
            // })()

            // convert query_result of RDFSConcepts to JSON to be used in documentation

            //execQuery(RDFSConceptsQuery(namedGraphsString4Qurery),
            //  "RDFConcepts")
            execQuery(childParentRelationQuery(namedGraphsString4Qurery
              .replace(
                /named/g, '')), "childParent")
              .then(function(childParentData) {
                console.log('1')
                execQuery(RDFSConceptsQuery(
                  namedGraphsString4Qurery), "RDFConcepts",
                  childParentData)
                  .then(function(data) {
                    var appdata = data;
                    appdata.sort(SortConcepts);
                    appdata = uniqueConcepts(appdata);
                    appdata.forEach(function(item) {
                      treeData = treeData.concat(item);
                    });
                    console.log('2')
                    execQuery(RDFSObjectsQuery(
                      namedGraphsString4Qurery), "RDFObjects")
                      .then(function(data) {
                        var RDFObjectsPlusURI = data;
                        console.log('3')
                        execQuery(individualsQuery(
                          namedGraphsString4Qurery),
                          "Individuals")
                          .then(function(data) {
                            var OWLIndividuals = data;
                            console.log('4')

                            // result of searched file of .ttl
                            var allFilesWithPaths = shell.exec(
                              'find ../repoFolder/ins3/develop/ -type f -name "*.ttl"', {
                                silent: false
                              });

                            var filesArray = allFilesWithPaths.split(
                              /[\n]/);
                            if (filesArray.length > 0) {
                              filesArray.pop();
                              for (var i in filesArray) {
                                filesArray[i] = filesArray[i]
                                  .split(
                                    "ins3/develop/")[
                                  1];
                              }
                              filesArray.sort(SortFiles);
                              filesArray = uniquefileNames(
                                filesArray);
                            }


                            var allRDFObjects = filterExternalConcept(
                              RDFObjectsPlusURI);
                            // var allSKOSObjects = filterExternalConcept(
                            // SKOSObjectsPlusURI);
                            res.render('documentation', {
                              title: 'Documentation',
                              data: treeData,
                              fileNames: filesArray,
                              allRDFObjects: allRDFObjects,
                              allSKOSObjects: "",
                              SKOSData: "",
                              RDFObjectsPlusURI: RDFObjectsPlusURI,
                              SKOSObjectsPlusURI: "",
                              OWLIndividuals: OWLIndividuals,
                              emptyData: false
                            });
                          // res.render('documentation', {
                          //   title: 'Documentation',
                          //   data: treeData,
                          //   fileNames: filesArray,
                          //   allRDFObjects: allRDFObjects,
                          //   allSKOSObjects: allSKOSObjects,
                          //   SKOSData: SKOSData,
                          //   RDFObjectsPlusURI: RDFObjectsPlusURI,
                          //   SKOSObjectsPlusURI: SKOSObjectsPlusURI,
                          //   OWLIndividuals: OWLIndividuals,
                          //   emptyData: false
                          // });
                          })
                      })
                  })

              })
              //  }))

              //  })
              // .then(execQuery(RDFSObjectsQuery(
              //   namedGraphsString4Qurery), "RDFObjects")
              //   .then(function(data) {
              //     console.log('RDFObjects data', data);
              //     console.log('3')
              //   }))
              // .then()
              // .then(function() {
              //   console.log("end")
              // })
              .catch(function(reason) {
                console.log('reason for rejection', reason)
              });

              // convert query_result of individuals to JSON to be used in documentation
              // execQuery(individualsQuery(namedGraphsString4Qurery),
              //   "Individuals").then(function(data) {
              //   console.log('common data', data);
              //   console.log('2')
              // }).catch(function(reason) {
              //   console.log('reason for rejection', reason)
              // });



          //Gererate JSONFile of RDFS_Concepts
          //generateRDFConcepts(namedGraphsString4Qurery);
          //Gererate JSONFile of RDFS_Objects
          //  generateRDFObjects(namedGraphsString4Qurery);
          //Gererate JSONFile of Individuals
          //  generateIndividuals(namedGraphsString4Qurery);
          //Gererate JSONFile of SKOS_Concepts
          //generateSKOSConcepts(namedGraphsString4Qurery);
          //Gererate JSONFile of SKOS_Objects
          //generateSKOSObjects(namedGraphsString4Qurery);
          }



          var filePath = 'jsonDataFiles/RDFSConcepts.json'
          fs.exists(filePath, function(exists) {
            if (exists) {
              (function clearRequireCache() {
                Object.keys(require.cache).forEach(
                  function(key) {
                    delete require.cache[key];
                  })
              })();


              // console.log("RDFConceptsJson");
              // console.log(RDFConceptsJson);
              // var appdata = JSON.stringify(getInput(
              //   namedGraphsString4Qurery, generateRDFConcepts
              // ));
              // console.log("appdata");
              // console.log(appdata);
              // var RDFObjectsPlusURI =
              // //generateRDFObjects(
              // //  namedGraphsString4Qurery);
              // require(
              //   '../jsonDataFiles/RDFSObjects.json');
              // var OWLIndividuals = //generateIndividuals(
              // //namedGraphsString4Qurery);
              // require(
              //   '../jsonDataFiles/OWLIndividuals.json');
              // //TODO:do for skos
              // var SKOSData = require(
              //   '../jsonDataFiles/SKOSConcepts.json');
              // var SKOSObjectsPlusURI = require(
              //   '../jsonDataFiles/SKOSObjects.json');
              //
              //
              // console.log(appdata);
              // // Call Sort By Name
              // appdata.sort(SortConcepts);
              // appdata = uniqueConcepts(appdata);
              // appdata.forEach(function(item) {
              //   treeData = treeData.concat(item);
              // });
              //
              // var concepts = [];
              // var allRDFObjects = filterExternalConcept(
              //   RDFObjectsPlusURI);
              // var allSKOSObjects = filterExternalConcept(
              //   SKOSObjectsPlusURI);

            // res.render('documentation', {
            //   title: 'Documentation',
            //   data: treeData,
            //   fileNames: filesArray,
            //   allRDFObjects: allRDFObjects,
            //   allSKOSObjects: allSKOSObjects,
            //   SKOSData: SKOSData,
            //   RDFObjectsPlusURI: RDFObjectsPlusURI,
            //   SKOSObjectsPlusURI: SKOSObjectsPlusURI,
            //   OWLIndividuals: OWLIndividuals,
            //   emptyData: false
            // });
            } else {
              res.render('documentation', {
                title: 'Documentation',
                data: null,
                fileNames: null,
                allRDFObjects: null,
                allSKOSObjects: null,
                SKOSData: null,
                RDFObjectsPlusURI: null,
                SKOSObjectsPlusURI: null,
                OWLIndividuals: null,
                emptyData: true
              });
            }
          });
        }
      } else {
        console.log(response.statusCode)
        console.warn(error);
        return null;
      }
    });
  }
});


module.exports = router;
