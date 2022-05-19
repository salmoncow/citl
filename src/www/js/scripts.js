/* on load */
function onLoad() {
    cookiesAllowed()

    // modal.style.display = "block";
}

/* Cookies */
var cookieFooter = document.getElementById("cookie-footer");

function setCookie(cname, cvalue, exdays) {
    if (cname == "cookies") {
        var expires = "expires=Fri, 31 Dec 9999 23:59:59 GMT;"
    } else {
        var d = new Date();
        d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
        var expires = "expires="+d.toUTCString();
    }

    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/;Secure;";
    cookieFooter.style.display = "none";
}

function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for(var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function cookiesAllowed() {
    if (getCookie("cookies") == "") {
        cookieFooter.style.display = "block";
    } else {
        cookieFooter.style.display = "none";
    }
}

function deleteCookie() {
    document.cookie = "cookies=true;expires=Fri, 31 Dec 1970 23:59:59 GMT;path=/;Secure;"
    console.log("Updated cookies:" + document.cookie)
}

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

/* Yardage calculator */
function openForm() {
    document.getElementById("handi-calc").style.display = "block";
}
  
function closeForm() {
    document.getElementById("handi-calc").style.display = "none";
}

function calculateHandicap(e) {
    if (e.preventDefault) e.preventDefault(); // prevent page reload on button push

    var avgs = [
        document.getElementsByName("avg1")[0].value,
        document.getElementsByName("avg2")[0].value,
        document.getElementsByName("avg3")[0].value,
        document.getElementsByName("avg4")[0].value,
        document.getElementsByName("avg5")[0].value,
    ]

    avgs = avgs.filter(e => e); // Remove empty strings

    if (avgs.length == 0) {
        return;
    }

    avgs.sort();

    if (avgs.length > 2) {
        avgs.shift(); // Drop min score
        avgs.pop();   // Drop max score
    }

    var avgsTotal = 0;
    for(var i = 0; i < avgs.length; i++) {
        avgsTotal += parseInt(avgs[i])
    }
    var yardage = Math.round(avgsTotal / avgs.length, 0);

    if (yardage < 16) yardage = 16;
    
    document.getElementById("result").innerHTML = "<h2>"+yardage+"</h2>";

    return;
}

var form = document.getElementById('handi-calc-form');
if (form != null) {
    if (form.attachEvent) {
        form.attachEvent("submit", calculateHandicap);
    } else {
        form.addEventListener("submit", calculateHandicap);
    }
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
