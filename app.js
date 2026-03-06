// ---------------- Firebase Setup ----------------
const firebaseConfig = {
  apiKey: "AIzaSyCQSoK5hColI1X31PCA4Ftl2_DG68d8wNA",
  authDomain: "flarecast-9eaf3.firebaseapp.com",
  projectId: "flarecast-9eaf3",
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ---------------- App State ----------------
let flareData = [];
let combinedChart, forecastChart;
let currentUser = null;

// ---------------- Auth Functions ----------------
function googleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).then(userCred => {
        currentUser = userCred.user;
        postLogin();
    });
}

function emailLogin() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    auth.signInWithEmailAndPassword(email,password)
        .then(userCred=>{
            currentUser = userCred.user;
            postLogin();
        })
        .catch(err=>{document.getElementById("loginMessage").innerText=err.message;});
}

function signup() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const name = document.getElementById("name").value;
    auth.createUserWithEmailAndPassword(email,password)
        .then(userCred=>{
            currentUser = userCred.user;
            db.collection("users").doc(currentUser.uid).set({name,email,isPaid:true});
            window.location.href="dashboard.html";
        })
        .catch(err=>{document.getElementById("signupMessage").innerText=err.message;});
}

function postLogin(){
    db.collection("users").doc(currentUser.uid).get().then(doc=>{
        if(doc.exists){
            window.location.href="dashboard.html";
        } else {
            // Default to free user if not in DB
            db.collection("users").doc(currentUser.uid).set({name:currentUser.displayName,email:currentUser.email,isPaid:false});
            window.location.href="dashboard.html";
        }
    });
}

function logout(){
    auth.signOut();
    localStorage.removeItem("painLogs");
    window.location.href="login.html";
}

// ---------------- Dashboard Functions ----------------
function initDashboard(){
    auth.onAuthStateChanged(user=>{
        if(!user){ window.location.href="login.html"; return; }
        currentUser = user;
        db.collection("users").doc(user.uid).get().then(doc=>{
            const isPaid = doc.data().isPaid;
            document.getElementById("welcome").innerText = `Welcome, ${doc.data().name}`;
            if(isPaid){ document.getElementById("paidFeatures").style.display="block"; getWeather(); renderPainTable(); updateCombinedChart(); get7DayForecast(); }
            else{ document.getElementById("freeFeatures").style.display="block"; getWeather(); }
        });
    });
}

// ---------------- Weather, Charts, Logs ----------------
// Use previous app.js logic here for:
// getWeather(), logPain(), renderPainTable(), updateCombinedChart(), get7DayForecast(), updateForecastChart()
// (Everything from the earlier full app.js can be reused here)
