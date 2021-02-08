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
var modal = document.getElementById("modal");
var span = document.getElementsByClassName("close-modal")[0];

if (span != null) {
    span.onclick = function() {
    modal.style.display = "none";
    }
}
// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
  if (event.target == modal) {
    modal.style.display = "none";
  }
} 


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
    if (e.preventDefault) e.preventDefault();

    var avg1 = Number(document.getElementsByName("avg1")[0].value);
    var avg2 = Number(document.getElementsByName("avg2")[0].value);
    var avg3 = Number(document.getElementsByName("avg3")[0].value);
    var avg4 = Number(document.getElementsByName("avg4")[0].value);
    var avg5 = Number(document.getElementsByName("avg5")[0].value);

    sum = avg1 + avg2 + avg3 + avg4 + avg5;

    if (sum <= 175.49) { yardage = "16 Yards" } else
    if (sum >= 175.50 && sum <= 185.49) { yardage = "17 Yards" } else
    if (sum >= 185.50 && sum <= 187.49) { yardage = "18 Yards" } else
    if (sum >= 187.50 && sum <= 189.49) { yardage = "19 Yards" } else
    if (sum >= 189.50 && sum <= 191.49) { yardage = "20 Yards" } else
    if (sum >= 191.50 && sum <= 193.49) { yardage = "21 Yards" } else
    if (sum >= 193.50 && sum <= 196.49) { yardage = "22 Yards" } else
    if (sum >= 196.50 && sum <= 201.49) { yardage = "23 Yards" } else
    if (sum >= 201.50 && sum <= 207.49) { yardage = "24 Yards" } else
    if (sum >= 207.50 && sum <= 211.49) { yardage = "25 Yards" } else
    if (sum >= 211.50 && sum <= 215.49) { yardage = "26 Yards" } else
    if (sum >= 215.50 && sum <= 250.00) { yardage = "27 Yards" } else { yardage = "Invalid" }
    
    document.getElementById("result").innerHTML = "<h2>"+yardage+"</h2>";
    return false;
}

var form = document.getElementById('handi-calc-form');
if (form != null) {
    if (form.attachEvent) {
        form.attachEvent("submit", calculateHandicap);
    } else {
        form.addEventListener("submit", calculateHandicap);
    }
}
