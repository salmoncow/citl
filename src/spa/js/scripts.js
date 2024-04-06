/* on load */
function onLoad() {
    // cookiesAllowed()

    // modal.style.display = "block";
}

/* Cookies */

/* Modal */
// var modal = document.getElementById("modal");
// var btn   = document.getElementById("modal-button");
// var span  = document.getElementsByClassName("modal-close")[0];

// btn.onclick = function() {
//     modal.style.display = "block";
// }

// if (span != null) {
//     span.onclick = function() {
//         modal.style.display = "none";
//     }
// }


/* Responsive top nav */
function burgerNav() {
    var x = document.getElementById("topnav");
    if (x.className === "topnav") {
        x.className += " responsive";
    } else {
        x.className = "topnav";
    }
}

/* Progress Bar */
window.onscroll = function() {progressBar()};
function progressBar() {
  var winScroll = document.body.scrollTop || document.documentElement.scrollTop;
  var height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
  var scrolled = (winScroll / height) * 100;
  document.getElementById("myBar").style.width = scrolled + "%";
} 

/* Collapsible scorecards */
var coll = document.getElementsByClassName("collapsible");
var i;

for (i = 0; i < coll.length; i++) {
    coll[i].addEventListener("click", function() {
        this.classList.toggle("active");
        var content = this.nextElementSibling;
        if (content.style.maxHeight){
            content.style.maxHeight = null;
        } else {
            content.style.maxHeight = content.scrollHeight + "px";
        }
    });
}

// Dropdown button in horizontal nav
function dropButton() {
    document.getElementById("dropdown").classList.toggle("dropdown-show");
}

window.onclick = function(event) {
    // close the dropdown menu if the user clicks outside of it
    if (!event.target.matches('.dropbtn')) {
        var dropdowns = document.getElementsByClassName("dropdown-content");
        var i;
        for (i = 0; i < dropdowns.length; i++) {
            var openDropdown = dropdowns[i];
            if (openDropdown.classList.contains('dropdown-show')) {
                openDropdown.classList.remove('dropdown-show');
            }
        }
    }

    // When the user clicks anywhere outside of the modal, close it
    // if (event.target == modal) {
    //     modal.style.display = "none";
    // }
}
