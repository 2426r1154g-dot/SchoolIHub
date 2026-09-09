import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, setDoc, getDoc, updateDoc, deleteDoc, query, orderBy, limit, onSnapshot, serverTimestamp, increment, where, getDocs } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-analytics.js";

/* Firebase Consoleで取得した設定に置き換えてね */
const firebaseConfig = {
  apiKey: "AIzaSyC9SHX_ikIMhUF5ifACKDc1x3vDh2p5-jo",
  authDomain: "sutudents-network.firebaseapp.com",
  projectId: "sutudents-network",
  storageBucket: "sutudents-network.firebasestorage.app",
  messagingSenderId: "392886016909",
  appId: "1:392886016909:web:fe27070d4c2e77117b7bc4",
  measurementId: "G-9QPJE95MDB"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let userData = {name:"学生", bio:""};
let posts = [], questions = [], events = [], studyLogs = [], ranking = [];
let unsubscribers = [];
let authMode = "login";
let boardFilter = "new";
let timerSeconds = 0, timerInterval = null, timerRunning = false;

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const timeText = ts => {
  if (!ts) return "たった今";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return "たった今";
  if (diff < 3600000) return `${Math.floor(diff/60000)}分前`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}時間前`;
  return d.toLocaleDateString("ja-JP");
};
const toast = msg => { $("toast").textContent = msg; $("toast").classList.add("show"); setTimeout(()=> $("toast").classList.remove("show"), 2200); };

function showPage(page){
  document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));
  $("page-"+page)?.classList.add("active");
  document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active", x.dataset.page===page));
  location.hash = page;
}
document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>showPage(b.dataset.page));
document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>showPage(b.dataset.go));
$("mobileMenu").onclick=()=>document.querySelector(".sidebar").classList.toggle("open");

document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  t.classList.add("active"); authMode=t.dataset.auth;
  $("authSubmit").textContent=authMode==="login"?"ログイン":"アカウントを作成";
  $("nameField").classList.toggle("hidden",authMode==="login");
});

$("authForm").onsubmit=async e=>{
  e.preventDefault();
  try{
    const email=$("authEmail").value.trim(), pass=$("authPassword").value, name=$("authName").value.trim();
    if(authMode==="login") await signInWithEmailAndPassword(auth,email,pass);
    else{
      const cred=await createUserWithEmailAndPassword(auth,email,pass);
      await updateProfile(cred.user,{displayName:name||"学生"});
      await setDoc(doc(db,"users",cred.user.uid),{name:name||"学生",bio:"",createdAt:serverTimestamp()},{merge:true});
    }
  }catch(e){toast(authError(e.code))}
};
function authError(c){return ({'auth/invalid-credential':'メールアドレスまたはパスワードが違うよ','auth/email-already-in-use':'そのメールアドレスは登録済みだよ','auth/weak-password':'パスワードは6文字以上にしてね','auth/invalid-email':'メールアドレスを確認してね'})[c]||"認証に失敗しました";}

$("logoutBtn").onclick=()=>signOut(auth);
$("themeBtn").onclick=()=>document.body.classList.toggle("dark");

onAuthStateChanged(auth, async u=>{
  unsubscribers.forEach(f=>f&&f()); unsubscribers=[];
  currentUser=u;
  $("authView").classList.toggle("hidden",!!u);
  $("appView").classList.toggle("hidden",!u);
  if(!u)return;
  const ref=doc(db,"users",u.uid), snap=await getDoc(ref);
  userData=snap.exists()?snap.data():{name:u.displayName||"学生",bio:""};
  $("headerName").textContent=userData.name;
  $("headerAvatar").textContent=(userData.name||"学").charAt(0);
  $("profileName").value=userData.name||"学生"; $("profileBio").value=userData.bio||"";
  subscribe();
  const hash=location.hash.replace("#","");
  if(["home","board","questions","events","study","ranking","profile"].includes(hash)) showPage(hash);
});

function subscribe(){
  const add=(q,fn)=>unsubscribers.push(onSnapshot(q,s=>fn(s.docs.map(d=>({id:d.id,...d.data()})))));
  add(query(collection(db,"posts"),orderBy("createdAt","desc"),limit(100)),v=>{posts=v;renderPosts();renderHome();updateStats()});
  add(query(collection(db,"questions"),orderBy("createdAt","desc"),limit(100)),v=>{questions=v;renderQuestions();updateStats()});
  add(query(collection(db,"events"),orderBy("date","asc"),limit(100)),v=>{events=v;renderEvents();renderHome();updateStats()});
  add(query(collection(db,"studyLogs"),orderBy("createdAt","desc"),limit(100)),v=>{studyLogs=v;renderStudy();updateStats();renderRanking()});
}

function renderPosts(){
  let arr=[...posts];
  if(boardFilter==="popular")arr.sort((a,b)=>(b.likes||0)-(a.likes||0));
  $("postList").innerHTML=arr.map(p=>`
  <div class="panel post" data-id="${p.id}">
    <div class="post-head"><div class="avatar">${esc((p.name||"学").charAt(0))}</div><div><div class="post-name">${esc(p.name)}</div><div class="post-time">${timeText(p.createdAt)}</div></div></div>
    <div class="post-text">${esc(p.text)}</div>
    <div class="post-actions">
      <button class="action ${p.likedBy?.includes(currentUser.uid)?"liked":""}" data-like="${p.id}">❤️ ${p.likes||0}</button>
      ${p.uid===currentUser.uid?`<button class="action" data-delete-post="${p.id}">🗑 削除</button>`:""}
    </div>
  </div>`).join("") || `<div class="panel muted">まだ投稿がないよ。</div>`;
}
$("postText").oninput=e=>$($("postChars").textContent=`${e.target.value.length} / 500`;

$("postBtn").onclick=async()=>{
  const text=$("postText").value.trim();
  if(!text)return toast("文章を入力してね");
  try{
    await addDoc(collection(db,"posts"),{
      uid:currentUser.uid,name:userData.name,text,likes:0,likedBy:[],createdAt:serverTimestamp()
    });
    $("postText").value=""; $("postChars").textContent="0 / 500";
    toast("投稿したよ！");
  }catch(e){console.error(e);toast("投稿に失敗したよ。Firebaseの設定を確認してね");}
};
document.addEventListener("click",async e=>{
  const like=e.target.closest("[data-like]"); if(like){
    const p=posts.find(x=>x.id===like.dataset.like); if(!p)return;
    const liked=p.likedBy?.includes(currentUser.uid);
    const ref=doc(db,"posts",p.id);
    await updateDoc(ref,{likes:increment(liked?-1:1),likedBy:liked?(p.likedBy||[]).filter(x=>x!==currentUser.uid):[...(p.likedBy||[]),currentUser.uid]});
  }
  const del=e.target.closest("[data-delete-post]"); if(del){const p=posts.find(x=>x.id===del.dataset.deletePost);if(p?.uid===currentUser.uid){await deleteDoc(doc(db,"posts",p.id));toast("削除したよ")}}
});
document.querySelectorAll(".filter").forEach(b=>b.onclick=()=>{document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");boardFilter=b.dataset.filter;renderPosts()});

$("questionBtn").onclick=async()=>{
  const title=$("questionTitle").value.trim(), body=$("questionBody").value.trim();
  if(!title||!body)return toast("タイトルと質問内容を入力してね");
  await addDoc(collection(db,"questions"),{uid:currentUser.uid,name:userData.name,title,body,answers:[],createdAt:serverTimestamp()});
  $("questionTitle").value="";$("questionBody").value="";toast("質問を投稿したよ！");
};
function renderQuestions(){
  $("questionList").innerHTML=questions.map(q=>`
  <div class="panel question"><div class="post-head"><div class="avatar">❓</div><div><b>${esc(q.name)}</b><div class="post-time">${timeText(q.createdAt)}</div></div></div>
  <div class="question-title">${esc(q.title)}</div><div class="post-text">${esc(q.body)}</div>
  ${(q.answers||[]).map(a=>`<div class="answer"><b>💡 ${esc(a.name)}</b><br>${esc(a.text)}</div>`).join("")}
  <button class="primary" data-answer="${q.id}">回答する</button></div>`).join("")||`<div class="panel muted">まだ質問がないよ。</div>`;
}
document.addEventListener("click",async e=>{
  const a=e.target.closest("[data-answer]");if(!a)return;
  const text=prompt("回答を入力してね");if(!text?.trim())return;
  const q=questions.find(x=>x.id===a.dataset.answer);if(!q)return;
  await updateDoc(doc(db,"questions",q.id),{answers:[...(q.answers||[]),{uid:currentUser.uid,name:userData.name,text:text.trim()}]});toast("回答したよ！");
});

$("eventBtn").onclick=async()=>{
  const title=$("eventTitle").value.trim(),date=$("eventDate").value,place=$("eventPlace").value.trim();
  if(!title||!date)return toast("イベント名と日時を入力してね");
  await addDoc(collection(db,"events"),{uid:currentUser.uid,title,date,place,createdAt:serverTimestamp()});
  $("eventTitle").value="";$("eventDate").value="";$("eventPlace").value="";toast("イベントを追加したよ！");
};
function renderEvents(){
  $("eventList").innerHTML=events.map(e=>`<div class="panel"><div class="event-date">📅 ${new Date(e.date).toLocaleString("ja-JP")}</div><div class="event-title">${esc(e.title)}</div><div class="event-place">📍 ${esc(e.place||"場所未定")}</div>${e.uid===currentUser.uid?`<br><button class="action" data-delete-event="${e.id}">削除</button>`:""}</div>`).join("")||`<div class="panel muted">予定がないよ。</div>`;
}
document.addEventListener("click",async e=>{const d=e.target.closest("[data-delete-event]");if(d){const ev=events.find(x=>x.id===d.dataset.deleteEvent);if(ev?.uid===currentUser.uid){await deleteDoc(doc(db,"events",ev.id));toast("削除したよ")}}});

$("studyBtn").onclick=async()=>{
  const minutes=Number($("studyMinutes").value),subject=$("studySubject").value;
  if(!minutes||minutes<1)return toast("勉強時間を入力してね");
  await addDoc(collection(db,"studyLogs"),{uid:currentUser.uid,name:userData.name,minutes,subject,createdAt:serverTimestamp()});
  $("studyMinutes").value="";toast(`${minutes}分記録したよ！`);
};
function renderStudy(){
  const mine=studyLogs.filter(x=>x.uid===currentUser.uid);
  const total=mine.reduce((s,x)=>s+(x.minutes||0),0);
  $("studyBig").textContent=total;$("studyProgress").style.width=Math.min(100,total/6)+"%";
  $("studyHistory").innerHTML=mine.slice(0,15).map(x=>`<div class="study-row"><span>📚 ${esc(x.subject)}</span><b>${x.minutes}分</b><span class="post-time">${timeText(x.createdAt)}</span></div>`).join("")||`<p class="muted">まだ記録がないよ。</p>`;
}
function renderRanking(){
  const m={};studyLogs.forEach(x=>{m[x.uid]??={uid:x.uid,name:x.name||"学生",minutes:0};m[x.uid].minutes+=x.minutes||0});
  const arr=Object.values(m).sort((a,b)=>b.minutes-a.minutes).slice(0,20);
  $("rankingList").innerHTML=arr.map((x,i)=>`<div class="rank"><div class="rank-num">${i+1}</div><div class="rank-avatar">${esc(x.name.charAt(0))}</div><div class="rank-main"><b>${esc(x.name)}</b></div><div class="rank-time">${x.minutes}分</div></div>`).join("")||`<p class="muted">まだランキングデータがないよ。</p>`;
}

$("profileSave").onclick=async()=>{
  const name=$("profileName").value.trim(),bio=$("profileBio").value.trim();if(!name)return toast("表示名を入力してね");
  await setDoc(doc(db,"users",currentUser.uid),{name,bio},{merge:true});await updateProfile(currentUser,{displayName:name});userData={...userData,name,bio};
  $("headerName").textContent=name;$("headerAvatar").textContent=name.charAt(0);$("profileAvatar").textContent=name.charAt(0);toast("プロフィールを保存したよ！");
};
function renderHome(){
  const popular=[...posts].sort((a,b)=>(b.likes||0)-(a.likes||0)).slice(0,3);
  $("homePosts").innerHTML=popular.map(p=>`<div class="post"><b>${esc(p.name)}</b><div class="post-text">${esc(p.text)}</div><span class="post-time">❤️ ${p.likes||0}</span></div>`).join("")||`<p class="muted">投稿がないよ。</p>`;
  $("homeEvents").innerHTML=events.slice(0,4).map(e=>`<div class="study-row"><b>${esc(e.title)}</b><span class="post-time">${new Date(e.date).toLocaleDateString("ja-JP")}</span></div>`).join("")||`<p class="muted">予定がないよ。</p>`;
}
function updateStats(){
  $("statPosts").textContent=posts.length;$("statQuestions").textContent=questions.length;$("statEvents").textContent=events.length;
  const total=studyLogs.filter(x=>x.uid===currentUser?.uid).reduce((s,x)=>s+(x.minutes||0),0);$("statStudy").textContent=total+"分";$("myStudy").textContent=total;
  const mine=posts.filter(x=>x.uid===currentUser?.uid);$("myPostCount").textContent=mine.length;$("myLikes").textContent=mine.reduce((s,x)=>s+(x.likes||0),0);
}

// ==================== 勉強タイマー ====================
function formatTimer(sec){
  const h=String(Math.floor(sec/3600)).padStart(2,"0");
  const m=String(Math.floor((sec%3600)/60)).padStart(2,"0");
  const s=String(sec%60).padStart(2,"0");
  return `${h}:${m}:${s}`;
}
function renderTimer(){
  $("timerDisplay").textContent=formatTimer(timerSeconds);
  $("timerStatus").textContent=timerRunning?"計測中":"停止中";
  $("timerStart").disabled=timerRunning;
  $("timerPause").disabled=!timerRunning;
}
$("timerStart").onclick=()=>{
  if(timerRunning)return;
  timerRunning=true;
  timerInterval=setInterval(()=>{timerSeconds++;renderTimer();},1000);
  renderTimer();
};
$("timerPause").onclick=()=>{
  if(!timerRunning)return;
  timerRunning=false;
  clearInterval(timerInterval); timerInterval=null;
  renderTimer();
};
$("timerReset").onclick=()=>{
  timerRunning=false;
  clearInterval(timerInterval); timerInterval=null;
  timerSeconds=0; renderTimer();
};
$("timerRecord").onclick=async()=>{
  const minutes=Math.floor(timerSeconds/60);
  if(minutes<1)return toast("1分以上計測してから記録してね");
  const subject=$("timerSubject").value;
  await addDoc(collection(db,"studyLogs"),{
    uid:currentUser.uid,name:userData.name,minutes,subject,
    source:"timer",createdAt:serverTimestamp()
  });
  timerSeconds=0; timerRunning=false;
  clearInterval(timerInterval); timerInterval=null;
  renderTimer();
  toast(`${minutes}分を勉強記録に追加したよ！`);
};
renderTimer();
