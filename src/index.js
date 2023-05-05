// main.js
// var contentful = require('contentful');

// var client = contentful.createClient({
//     space: 'lah0012agjlk',
//     accessToken: 'EuC-ZVzBh3Hg7-4oCNoObcCErPf_shNs0N0Yxm-UcqA',
// });

// client.getEntries().then(function (entries) {
//     console.log('got stuff');
//   // log the title for all the entries that have it
//   entries.items.forEach(function (entry) {
//     if (entry.fields.productName) {
//       console.log(entry.fields.productName);
//     }
//   });
// });

let dir = 0;
window.onscroll = function (e) {
  // print "false" if direction is down and "true" if up
  dir = this.oldScroll > this.scrollY ? 1 : -1;
  this.oldScroll = this.scrollY;
};

const divs = document.querySelectorAll(".content");
let callback = (entries, observer) => {
  entries.forEach((entry) => {
    const targetDiv = document.querySelector(`[href="#${entry.target.id}"]`);
    if (entry.isIntersecting) targetDiv.classList.add("active");
    const active = [...document.querySelectorAll(".active")];
    if (active.length > 1) active[dir === 1 ? 1 : 0].classList.remove("active");
  });
};

const observer = new IntersectionObserver(callback);
divs.forEach((div) => observer.observe(div));
