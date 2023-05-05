/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./src/index.js":
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
/***/ (() => {

eval("// main.js\n// var contentful = require('contentful');\n\n// var client = contentful.createClient({\n//     space: 'lah0012agjlk',\n//     accessToken: 'EuC-ZVzBh3Hg7-4oCNoObcCErPf_shNs0N0Yxm-UcqA',\n// });\n\n// client.getEntries().then(function (entries) {\n//     console.log('got stuff');\n//   // log the title for all the entries that have it\n//   entries.items.forEach(function (entry) {\n//     if (entry.fields.productName) {\n//       console.log(entry.fields.productName);\n//     }\n//   });\n// });\n\nlet dir = 0;\nwindow.onscroll = function (e) {\n  // print \"false\" if direction is down and \"true\" if up\n  dir = this.oldScroll > this.scrollY ? 1 : -1;\n  this.oldScroll = this.scrollY;\n};\n\nconst divs = document.querySelectorAll(\".content\");\nlet callback = (entries, observer) => {\n  entries.forEach((entry) => {\n    const targetDiv = document.querySelector(`[href=\"#${entry.target.id}\"]`);\n    if (entry.isIntersecting) targetDiv.classList.add(\"active\");\n    const active = [...document.querySelectorAll(\".active\")];\n    if (active.length > 1) active[dir === 1 ? 1 : 0].classList.remove(\"active\");\n  });\n};\n\nconst observer = new IntersectionObserver(callback);\ndivs.forEach((div) => observer.observe(div));\n\n\n//# sourceURL=webpack://klimaatpersco/./src/index.js?");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = {};
/******/ 	__webpack_modules__["./src/index.js"]();
/******/ 	
/******/ })()
;