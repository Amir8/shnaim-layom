(function(){
"use strict";

/* ================= נתוני התנ"ך ================= */
var SECTIONS=[
 ["תורה",[["בראשית",50],["שמות",40],["ויקרא",27],["במדבר",36],["דברים",34]]],
 ["נביאים",[["יהושע",24],["שופטים",21],["שמואל א",31],["שמואל ב",24],["מלכים א",22],["מלכים ב",25],
   ["ישעיהו",66],["ירמיהו",52],["יחזקאל",48],["הושע",14],["יואל",4],["עמוס",9],["עובדיה",1],
   ["יונה",4],["מיכה",7],["נחום",3],["חבקוק",3],["צפניה",3],["חגי",2],["זכריה",14],["מלאכי",3]]],
 ["כתובים",[["תהילים",150],["משלי",31],["איוב",42],["שיר השירים",8],["רות",4],["איכה",5],
   ["קהלת",12],["אסתר",10],["דניאל",12],["עזרא",10],["נחמיה",13],["דברי הימים א",29],["דברי הימים ב",36]]]
];
/* התוכנית: נביאים וכתובים בלבד, מיהושע ואילך (בלי חומשי תורה) - בקשת המשתמש 2026-11-14.
   מספור הדפים של 929 נשמר קנוני על כל התנ"ך: יהושע א נשאר page/188. */
var ALL_SECTIONS=SECTIONS;
SECTIONS=ALL_SECTIONS.slice(1);
var TOTAL=0, ORDER=[], SEQ={}, VISIBLE={};
var page=0;
ALL_SECTIONS.forEach(function(s){ s[1].forEach(function(b){
  for(var c=1;c<=b[1];c++){ page++; SEQ[b[0]+"|"+c]=page; }
});});
SECTIONS.forEach(function(s){ s[1].forEach(function(b){
  VISIBLE[b[0]]=b[1];
  for(var c=1;c<=b[1];c++) ORDER.push([b[0],c]);
  TOTAL+=b[1];
});});
var BOOKS_COUNT=0; SECTIONS.forEach(function(s){ BOOKS_COUNT+=s[1].length; });

/* ================= עזר ================= */
var ON=["","א","ב","ג","ד","ה","ו","ז","ח","ט"],TE=["","י","כ","ל","מ","נ","ס","ע","פ","צ"],HU=["","ק","ר","ש","ת"];
function heb(n){
  var h=Math.floor(n/100), r=n%100, s=HU[h];
  if(r==15) s+="ט״ו"; else if(r==16) s+="ט״ז";
  else { s+=TE[Math.floor(r/10)]+ON[r%10]; }
  if(s.length>1 && s.indexOf("״")<0) s=s.slice(0,-1)+"״"+s.slice(-1);
  else if(s.length==1) s=s+"׳";
  return s;
}
function todayStr(d){
  d=d||new Date();
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function $(id){ return document.getElementById(id); }
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(ch){
  return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]; }); }
var toastTimer=null;
function toast(msg){
  var t=$("toast"); t.textContent=msg; t.hidden=false;
  clearTimeout(toastTimer); toastTimer=setTimeout(function(){ t.hidden=true; },3200);
}

/* ================= מצב אישי (מעקב) ================= */
var KEY="shnaim-layom-v1";
/* כל משתמש מחובר מקבל מעין אחסון מקומי משלו: אין דליפת סימונים בין אנשים על אותו מכשיר */
function activeKey(){ return session ? KEY+":"+session.user.id : KEY; }
function loadState(k){ try{ return JSON.parse(localStorage.getItem(k)||"{}")||{}; }catch(e){ return {}; } }
function unionStates(a,b){
  var out={};
  [a,b].forEach(function(s){ for(var bk in s) for(var c in s[bk]){
    if(!out[bk]) out[bk]={};
    if(!out[bk][c] || s[bk][c]<out[bk][c]) out[bk][c]=s[bk][c];
  }});
  return out;
}
function countIn(s){ var n=0; for(var b in s) n+=Object.keys(s[b]).length; return n; }
var state=loadState(KEY);
function save(){ try{ localStorage.setItem(activeKey(),JSON.stringify(state)); }catch(e){} }
/* מחיקות שעוד לא אושרו בשרת - כדי שמחיקה לא "תקום לתחייה" אחרי סנכרון */
function pendingDelKey(){ return activeKey()+"|del"; }
function getPendingDel(){ try{ return JSON.parse(localStorage.getItem(pendingDelKey())||"[]"); }catch(e){ return []; } }
function setPendingDel(l){ try{ localStorage.setItem(pendingDelKey(),JSON.stringify(l)); }catch(e){} }
function pendDelete(b,c){ if(!session) return; var l=getPendingDel(); var cs=String(c);
  for(var i=0;i<l.length;i++) if(l[i][0]===b&&l[i][1]===cs) return;
  l.push([b,cs]); setPendingDel(l); }
function unpendDelete(b,c){ if(!session) return; var cs=String(c);
  setPendingDel(getPendingDel().filter(function(x){ return !(x[0]===b&&x[1]===cs); })); }
/* סימונים של חומש (אם יובאו מגיבוי ישן) נשמרים בלי מחיקה אבל לא נספרים בתוכנית */
function doneCount(){ var n=0; for(var b in state){ if(!VISIBLE[b]) continue;
  for(var c in state[b]) if(+c<=VISIBLE[b]) n++; } return n; }
function allDates(){
  var ds={};
  for(var b in state){ if(!VISIBLE[b]) continue;
    for(var c in state[b]) if(+c<=VISIBLE[b]) ds[state[b][c]]=1; }
  return ds;
}
function calcStreak(ds){
  var streak=0, cur=new Date();
  if(!ds[todayStr(cur)]) cur.setDate(cur.getDate()-1);
  for(;;){
    if(ds[todayStr(cur)]){ streak++; cur.setDate(cur.getDate()-1); } else break;
  }
  return streak;
}

/* בניית רשימת הספרים */
var booksEl=$("books");
SECTIONS.forEach(function(sec){
  var st=document.createElement("div"); st.className="sec-title"; st.textContent=sec[0]; booksEl.appendChild(st);
  sec[1].forEach(function(bk){
    var name=bk[0], ch=bk[1];
    var el=document.createElement("div"); el.className="book"; el.dataset.name=name;
    var head=document.createElement("button"); head.className="book-head";
    head.innerHTML='<span class="chev">◀</span><span class="nm">'+esc(name)+'</span>'+
      '<div class="bar"><i></i></div><span class="cnt"></span>';
    head.onclick=function(){ el.classList.toggle("open"); };
    var grid=document.createElement("div"); grid.className="grid";
    for(var c=1;c<=ch;c++){
      (function(c){
        var cell=document.createElement("button"); cell.className="cell"; cell.dataset.ch=c;
        cell.textContent=heb(c);
        cell.setAttribute("aria-label",name+" פרק "+heb(c));
        cell.onclick=function(){ toggleChapter(name,c); };
        grid.appendChild(cell);
      })(c);
    }
    el.appendChild(head); el.appendChild(grid); booksEl.appendChild(el);
  });
});


/* General site links, private to this device/account. Older chapter links remain stored untouched. */
function closeChapter(){}
function siteLinksKey(){return activeKey()+"|site-resources";}
function validSiteUrl(v){try{var u=new URL(v);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.href:null;}catch(e){return null;}}
function renderSites(){
 var root=$("siteLinks"),list=[];try{list=JSON.parse(localStorage.getItem(siteLinksKey())||"[]");}catch(e){}if(!Array.isArray(list))list=[];
 root.innerHTML="";
 list.forEach(function(x,i){var u=validSiteUrl(x.url);if(!u)return;var row=document.createElement("div");row.className="resource-row";var a=document.createElement("a");a.href=u;a.target="_blank";a.rel="noopener noreferrer";a.textContent=x.title||u;var del=document.createElement("button");del.className="btn-ghost";del.textContent="מחיקה";del.onclick=function(){list.splice(i,1);localStorage.setItem(siteLinksKey(),JSON.stringify(list));renderSites();};row.append(a,del);root.appendChild(row);});
 $("siteAdd").onclick=function(){var u=validSiteUrl($("siteUrl").value.trim()),t=$("siteTitle").value.trim();if(!u||!t){$("siteStatus").textContent="צריך שם וכתובת מלאה של האתר";return;}if(list.length>=30){$("siteStatus").textContent="אפשר לשמור עד 30 אתרים";return;}list.push({title:t,url:u});try{localStorage.setItem(siteLinksKey(),JSON.stringify(list));renderSites();$("siteTitle").value="";$("siteUrl").value="";$("siteForm").hidden=true;toast("הקישור נשמר במכשיר");}catch(e){$("siteStatus").textContent="לא נשמר: האחסון במכשיר אינו זמין";}};
}
$("siteToggle").onclick=function(){$("siteForm").hidden=!$("siteForm").hidden;};

function toggleChapter(name,c){
  var wasDone = !!(state[name] && state[name][c]);
  if(wasDone){
    delete state[name][c]; if(!Object.keys(state[name]).length) delete state[name];
    pendDelete(name,c);
  } else {
    if(!state[name]) state[name]={}; state[name][c]=todayStr();
    unpendDelete(name,c);
  }
  save(); refresh();
  syncChapter(name, c, wasDone ? null : state[name][c]);
}

var nextBook=null;
function refresh(){
  renderSites();
  var today=todayStr(), done=doneCount(), todayN=0, booksDone=0;
  var ds=allDates();
  if(ds[today]){ for(var b in state) for(var c in state[b]) if(state[b][c]===today) todayN++; }
  var p=done/TOTAL*100;
  $("pct").textContent = done===0 ? "0%" : (p<10 ? (Math.round(p*10)/10)+"%" : Math.round(p)+"%");
  $("of929").textContent=done+" מתוך "+TOTAL;
  $("stToday").textContent=todayN;
  $("stLeft").textContent=(TOTAL-done);
  $("stStreak").textContent=calcStreak(ds);
  var C=295.3;
  $("ringfill").setAttribute("stroke-dashoffset", C*(1-done/TOTAL));
  var lastDone=-1;
  ORDER.forEach(function(o,i){ if(state[o[0]]&&state[o[0]][o[1]]) lastDone=i; });
  var next=null;
  for(var i=lastDone+1;i<ORDER.length;i++){ if(!(state[ORDER[i][0]]&&state[ORDER[i][0]][ORDER[i][1]])){ next=ORDER[i]; break; } }
  if(!next) for(var i2=0;i2<ORDER.length;i2++){ if(!(state[ORDER[i2][0]]&&state[ORDER[i2][0]][ORDER[i2][1]])){ next=ORDER[i2]; break; } }
  if(next){ nextBook=next[0]; }
  document.querySelectorAll(".book").forEach(function(el){
    var name=el.dataset.name, cells=el.querySelectorAll(".cell"), d=0, ch=cells.length;
    cells.forEach(function(cell){
      var c=cell.dataset.ch, is=state[name]&&state[name][c];
      cell.classList.toggle("done",!!is);
      cell.classList.toggle("today-mark",!!(is&&state[name][c]===today));
      if(is) d++;
    });
    el.querySelector(".bar i").style.width=(d/ch*100)+"%";
    el.querySelector(".cnt").textContent=d+"/"+ch;
    if(d==ch) booksDone++;
  });
  $("stBooks").textContent=booksDone+"/"+BOOKS_COUNT;
  if(next){
    $("nextWrap").style.display="flex";
    $("nextName").textContent=next[0]+" "+heb(next[1]);
    $("next929").href="https://www.929.org.il/page/"+SEQ[next[0]+"|"+next[1]];
    var gl=(window.YGOLAN||{})[next[0]+"|"+next[1]]; var gn=$("nextGolan");
    if(gn){ if(gl){ gn.href=gl; gn.style.display="inline-block"; } else gn.style.display="none"; }
  } else $("nextWrap").style.display="none";
}

/* ================= גיבוי / ייבוא (תואם לאפליקציה הישנה) ================= */
function exportBackup(){
  var blob=new Blob([JSON.stringify({app:"shnaim-layom",version:2,exported:todayStr(),state:state},null,1)],{type:"application/json"});
  var a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  a.download="shnaim-layom-backup.json"; a.click();
}
function importBackupFile(f){
  var r=new FileReader();
  r.onload=function(){
    try{
      var j=JSON.parse(r.result), s=j.state||j;
      if(typeof s!=="object"||Array.isArray(s)) throw 0;
      var added=0;
      for(var b in s) for(var c in s[b]){
        if(!state[b]) state[b]={};
        if(!state[b][c]){ state[b][c]=s[b][c]; added++; }
        else if(s[b][c] < state[b][c]) state[b][c]=s[b][c];
      }
      save(); refresh(); syncNow();
      toast(added ? "הגיבוי נטען: נוספו "+added+" סימונים" : "הגיבוי נטען, לא היו סימונים חדשים");
    }catch(x){ toast("הקובץ לא תקין"); }
  };
  r.readAsText(f);
}
$("imp").addEventListener("change",function(e){
  var f=e.target.files[0]; if(f) importBackupFile(f); e.target.value="";
});

/* ================= לשוניות ================= */
document.querySelectorAll("#tabs .tab").forEach(function(t){
  t.onclick=function(){
    document.querySelectorAll("#tabs .tab").forEach(function(x){ x.classList.remove("active"); });
    t.classList.add("active");
    ["view-track","view-group","view-settings"].forEach(function(v){ $(v).hidden = v!==t.dataset.view; });
    if(t.dataset.view==="view-group") renderGroup();
    if(t.dataset.view==="view-settings") renderSettings();
  };
});

/* ================= תזכורת יומית אישית ================= */
var REM_KEY="shnaim-layom-reminder";
function getRem(){ try{ return JSON.parse(localStorage.getItem(REM_KEY)||"null")||{enabled:false,time:"20:00"}; }catch(e){ return {enabled:false,time:"20:00"}; } }
function setRem(r){ localStorage.setItem(REM_KEY,JSON.stringify(r)); scheduleReminder(); }
var remTimer=null;
function scheduleReminder(){
  clearTimeout(remTimer);
  var r=getRem(); if(!r.enabled) return;
  var parts=r.time.split(":"), now=new Date(), next=new Date();
  next.setHours(+parts[0], +parts[1], 0, 0);
  if(next<=now) next.setDate(next.getDate()+1);
  var delta=Math.min(next-now, 2147000000);
  remTimer=setTimeout(function(){ fireReminder(); scheduleReminder(); }, delta);
}
function fireReminder(){
  var title="שניים ליום", body="היום עוד לא סימנת פרק. זמן לנ״ך?";
  if(allDates()[todayStr()]) body="סימנת היום. כל הכבוד!";
  if("Notification" in window && Notification.permission==="granted"){
    try{ new Notification(title,{body:body}); return; }catch(e){}
  }
  toast(body);
}
function buildICS(){
  var r=getRem(), parts=r.time.split(":");
  var now=new Date(), d=new Date();
  d.setHours(+parts[0], +parts[1], 0, 0);
  if(d<=now) d.setDate(d.getDate()+1);
  function p(n){ return String(n).padStart(2,"0"); }
  var dt=d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+"T"+p(d.getHours())+p(d.getMinutes())+"00";
  var stamp=todayStr().replace(/-/g,"")+"T000000";
  var ics=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//shnaim-layom//he","BEGIN:VEVENT",
    "UID:shnaim-daily-"+stamp+"@shnaim-layom","DTSTAMP:"+stamp,
    "DTSTART:"+dt,"RRULE:FREQ=DAILY",
    "SUMMARY:שניים ליום · קריאת פרק תנ״ך",
    "BEGIN:VALARM","TRIGGER:-PT0M","ACTION:DISPLAY","DESCRIPTION:זמן לפרק היומי","END:VALARM",
    "END:VEVENT","END:VCALENDAR"].join("\r\n");
  var blob=new Blob([ics],{type:"text/calendar"});
  var a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  a.download="shnaim-layom-reminder.ics"; a.click();
}

/* ================= הגדרות ================= */
function renderSettings(){
  var r=getRem(), root=$("settingsRoot");
  var cloud = CLOUD_MODE;
  var accHtml;
  if(!cloud){
    accHtml='<div class="card"><h2>חשבון וסנכרון</h2>'+
      '<p>כרגע האפליקציה במצב מקומי: הסימונים נשמרים במכשיר הזה בלבד. '+
      'סנכרון בין מכשירים וקבוצות יופעלו אחרי שהמנהל מחבר את השרת המשותף (הפעלה חד־פעמית, חינם - ההוראות בקובץ README שבקוד).</p></div>';
  } else if(session){
    accHtml='<div class="card"><h2>החשבון שלי</h2>'+
      '<p>מחובר/ת כ־'+(session.user.email?esc(session.user.email):"")+'</p>'+
      '<label class="f">השם שיוצג לחברי הקבוצה</label>'+
      '<input type="text" id="dispName" maxlength="30" value="'+esc(profile&&profile.display_name||"")+'" placeholder="השם שלי">'+
      '<div class="row"><button class="btn-volt" id="saveName">שמירת שם</button>'+
      '<button class="btn-ghost" id="logoutBtn">התנתקות</button></div>'+
      (countIn(loadState(KEY))>0 ? '<div class="hr"></div><p>יש במכשיר סימונים ללא חשבון. הם נשארים נפרדים ולא הועלו לחשבון הזה.</p><button class="btn-ghost" id="importLocalBtn">ייבוא סימוני המכשיר לחשבון הזה</button>' : '')+'</div>';
  } else {
    accHtml='<div class="card"><h2>התחברות</h2>'+
      '<p>התחברות בלחיצה אחת עם חשבון Google. אחרי ההתחברות המעקב מסונכרן בין המכשירים שלך ואפשר להצטרף לקבוצה.</p>'+
      '<div class="row"><a class="btn-volt" id="googleBtn" href="'+esc(CFG.SUPABASE_URL+'/auth/v1/authorize?provider=google&redirect_to='+encodeURIComponent(location.origin+location.pathname))+'" style="display:inline-block;text-align:center;text-decoration:none">התחברות עם Google</a></div>'+
      (CFG.EMAIL_AUTH===true?
        '<div class="hr"></div>'+
        '<label class="f">אימייל</label><input type="email" id="emailIn" dir="ltr" placeholder="me@example.com">'+
        '<div class="row"><button class="btn-ghost" id="loginBtn">שלחו לי קישור כניסה</button></div>'
      :'')+
      '</div>';
  }
  root.innerHTML=
    accHtml+
    '<div class="card"><h2>תזכורת יומית</h2>'+
    '<div style="display:flex;align-items:center;gap:12px;justify-content:space-between">'+
      '<div><b>תזכורת ללמוד</b><p style="margin:2px 0 0">בשעה קבועה שאת/ה בוחר/ת</p></div>'+
      '<label class="switch"><input type="checkbox" id="remOn" '+(r.enabled?"checked":"")+'><span class="sl"></span></label></div>'+
    '<div style="margin-top:12px"><label class="f">שעה</label><input type="time" id="remTime" value="'+esc(r.time)+'"></div>'+
    '<div class="row"><button class="btn-volt" id="remSave">שמירת התזכורת</button></div>'+
    '<div class="hr"></div><h3>איך מקבלים את התזכורת בפועל?</h3>'+
    '<p><b>האופציה האמינה בטלפון:</b> הוספת התזכורת ליומן - יורד קובץ שפותח אירוע יומי חוזר ביומן שלך, והיומן מתריע גם כשהאפליקציה סגורה.</p>'+
    '<div class="row"><button class="btn-ghost" id="icsBtn">הוספה ליומן (קובץ ICS)</button></div>'+
    '<p><b>התראות push מהשרת (האופציה הטובה ביותר אחרי חיבור השרת):</b> התראה אמיתית בשעה שבחרת, גם כשהאפליקציה סגורה לגמרי. באייפון נדרש iOS 16.4 ומעלה ו"הוספה למסך הבית", וחיבור לחשבון.</p>'+
    pushButtonHtml()+
    '<p><b>התראות דפדפן מקומיות:</b> פועלות רק כשהאפליקציה פתוחה או ברקע.</p>'+
    '<div class="row"><button class="btn-ghost" id="notifBtn">אישור התראות דפדפן</button></div></div>'+
    '<div class="card"><h2>גיבוי ושחזור</h2>'+
    '<p>ייצוא כל הסימונים לקובץ, וייבוא חזרה - כולל קובץ הגיבוי של האפליקציה הישנה. בייבוא, סימונים קיימים לא נמחקים.</p>'+
    '<div class="row"><button class="btn-volt" id="expBtn">ייצוא גיבוי</button>'+
    '<button class="btn-ghost" id="impBtn">ייבוא גיבוי</button></div></div>'+
    '<div class="note">שניים ליום · גרסה 2 · המעקב האישי שלך, השיתוף - רק במפורש ובבחירתך.</div>';

  if(cloud && !session){
    if($("loginBtn")) $("loginBtn").onclick=doLogin;
    $("googleBtn").onclick=doLoginGoogle;
  }
  if(cloud && session){
    $("saveName").onclick=saveDisplayName;
    $("logoutBtn").onclick=doLogout;
    if($("importLocalBtn")) $("importLocalBtn").onclick=function(){
      if(!confirm("לצרף את הסימונים ללא חשבון שבמכשיר הזה להתקדמות של "+session.user.email+"? הסימונים הקיימים לא יימחקו.")) return;
      state=unionStates(state,loadState(KEY)); save(); refresh();
      syncNow().then(function(){toast("הסימונים נוספו לחשבון. המקור במכשיר נשמר.");});
    };
  }
  $("remSave").onclick=function(){
    var t=$("remTime").value||"20:00";
    setRem({enabled:$("remOn").checked, time:t});
    if(sb && session){ sb.from("push_subscriptions").update({reminder_time:t}).eq("user_id",session.user.id).then(noop); }
    toast($("remOn").checked ? "התזכורת נשמרה לשעה "+t : "התזכורת כבויה");
  };
  $("icsBtn").onclick=function(){
    var t=$("remTime").value||"20:00";
    setRem({enabled:$("remOn").checked, time:t});
    buildICS(); toast("הורד קובץ ליומן - פתח/י אותו בטלפון כדי לשמור");
  };
  $("notifBtn").onclick=function(){
    if(!("Notification" in window)){ toast("הדפדפן הזה לא תומך בהתראות"); return; }
    Notification.requestPermission().then(function(p){
      toast(p==="granted" ? "ההתראות אושרו" : "ההתראות לא אושרו - אפשר דרך היומן");
    });
  };
  $("expBtn").onclick=exportBackup;
  $("impBtn").onclick=function(){ $("imp").click(); };
  if($("pushBtn")) $("pushBtn").onclick=subscribePush;
}

/* ================= התראות push מהשרת ================= */
function pushButtonHtml(){
  if(!CLOUD_MODE || !session || !CFG.VAPID_PUBLIC_KEY){
    return '<p style="color:var(--mut)">יופעל אחרי שהשרת המשותף מחובר ומוגדר (שלב ההפעלה החד־פעמי ב־README).</p>';
  }
  return '<div class="row"><button class="btn-volt" id="pushBtn">הפעלת התראות push יומיות</button></div>';
}
function urlB64ToUint8(s){
  var pad="=".repeat((4-s.length%4)%4);
  var b=atob((s+pad).replace(/-/g,"+").replace(/_/g,"/"));
  var out=new Uint8Array(b.length);
  for(var i=0;i<b.length;i++) out[i]=b.charCodeAt(i);
  return out;
}
function subscribePush(){
  if(!sb || !session) return;
  if(!("serviceWorker" in navigator) || !("PushManager" in window)){
    toast("המכשיר לא תומך ב־push - באייפון צריך להוסיף למסך הבית קודם"); return;
  }
  Notification.requestPermission().then(function(p){
    if(p!=="granted"){ toast("לא אושרו התראות"); return; }
    navigator.serviceWorker.ready.then(function(reg){
      return reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:urlB64ToUint8(CFG.VAPID_PUBLIC_KEY)});
    }).then(function(sub){
      var j=sub.toJSON(), r=getRem();
      return sb.from("push_subscriptions").upsert({
        user_id:session.user.id, endpoint:sub.endpoint,
        p256dh:j.keys.p256dh, auth:j.keys.auth,
        reminder_time:r.time, tz:(Intl.DateTimeFormat().resolvedOptions().timeZone||"Asia/Jerusalem"),
        enabled:true
      },{onConflict:"endpoint"});
    }).then(function(r){
      if(r && r.error){ toast("לא נשמר: "+r.error.message); return; }
      toast("התראות push הופעלו - יגיעו כל יום ב־"+getRem().time);
    }).catch(function(e){ toast("הפעלת push נכשלה: "+e.message); });
  });
}

/* ================= שכבת ענן (Supabase) ================= */
var CFG = window.SHNAIM_CONFIG||{};
var CLOUD_MODE = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
var sb=null, session=null, profile=null, myGroup=null;

function loadSupabase(){
  return new Promise(function(resolve,reject){
    if(window.supabase){ resolve(); return; }
    var s=document.createElement("script");
    s.src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
    s.onload=function(){ resolve(); };
    s.onerror=function(){
      var fallback=document.createElement("script");
      fallback.src="https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js";
      fallback.onload=resolve;
      fallback.onerror=function(){reject(new Error("cdn"));};
      document.head.appendChild(fallback);
    };
    document.head.appendChild(s);
  });
}

function initCloud(){
  if(!CLOUD_MODE){ setModeBadge(); return; }
  loadSupabase().then(function(){
    sb=window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    sb.auth.onAuthStateChange(function(ev,sess){
      var oldId=session&&session.user.id, newId=sess&&sess.user.id;
      session=sess;
      if(oldId!==newId){
        myGroup=null; profile=null; state=loadState(activeKey()); refresh();
        closeChapter(); $("groupRoot").innerHTML=""; $("settingsRoot").innerHTML="";
        renderSettings(); renderGroup();
      }
      setModeBadge();
      if(sess){ setTimeout(function(){ if(session && session.user.id===sess.user.id) onLoggedIn(); },0); } else { myGroup=null; profile=null; }
    });
    return sb.auth.getSession();
  }).then(function(res){
    if(res && res.data && res.data.session){ session=res.data.session; setModeBadge(); onLoggedIn(); }
  }).catch(function(){
    setModeBadge();
    toast("רכיב החיבור לא נטען. אפשר לפתוח את הכניסה ל־Google ולרענן אחרי החזרה.");
  });
}

function setModeBadge(){
  var b=$("modeBadge"); b.hidden=false;
  if(!CLOUD_MODE){ b.textContent="מצב מקומי · נשמר במכשיר"; b.className="badge"; }
  else if(session){ b.textContent="מסונכרן לחשבון"; b.className="badge cloud"; }
  else { b.textContent="לא מחובר · נשמר במכשיר"; b.className="badge"; }
  var lb=$("loginBanner"); if(lb) lb.hidden=!(CLOUD_MODE && !session);
  $("storageNote").textContent = CLOUD_MODE
    ? "הסימונים נשמרים אוטומטית במכשיר, וכשאת/ה מחובר/ת הם מסונכרנים גם לחשבון שלך ועוברים איתך בין מכשירים. אף אחד לא רואה את ההתקדמות שלך אלא אם הפעלת שיתוף בקבוצה."
    : "הסימונים נשמרים אוטומטית במכשיר הזה (בדפדפן). כדי לגבות או להעביר: הגדרות ← ייצוא גיבוי. ניקוי נתוני הדפדפן מוחק את הסימונים.";
}

function doLoginGoogle(){
  var target=CFG.SUPABASE_URL+"/auth/v1/authorize?provider=google&redirect_to="+encodeURIComponent(location.origin+location.pathname);
  location.assign(target);
}

function doLogin(){
  var em=$("emailIn").value.trim();
  if(!em || em.indexOf("@")<0){ toast("כתובת אימייל לא תקינה"); return; }
  $("loginBtn").disabled=true; $("loginBtn").textContent="שולח...";
  sb.auth.signInWithOtp({email:em, options:{emailRedirectTo:location.origin+location.pathname}}).then(function(r){
    $("loginBtn").disabled=false; $("loginBtn").textContent="שלחו לי קישור כניסה";
    if(r.error){
      toast(r.error.code==="over_email_send_rate_limit"
        ? "נשלחו לאחרונה יותר מדי מיילים - נסו שוב בעוד כשעה"
        : "שגיאה: "+r.error.message);
      return;
    }
    toast("נשלח קישור כניסה ל־"+em+" - בדקו את המייל");
  });
}
function doLogout(){
  sb.auth.signOut().then(function(){
    session=null; profile=null; myGroup=null;
    state=loadState(KEY); refresh(); $("groupRoot").innerHTML=""; /* חזרה למעקב האנונימי בלבד - נתוני החשבון נשארים במעין הפרטי */
    setModeBadge(); renderSettings(); toast("התנתקת");
  });
}
function saveDisplayName(){
  var n=$("dispName").value.trim();
  if(!n){ toast("צריך שם"); return; }
  sb.from("profiles").upsert({id:session.user.id, display_name:n}).then(function(r){
    if(r.error){ toast("לא נשמר: "+r.error.message); return; }
    profile={id:session.user.id, display_name:n};
    toast("השם נשמר");
  });
}

function onLoggedIn(){
  var owner=session.user.id;
  sb.from("profiles").select("*").eq("id",session.user.id).maybeSingle().then(function(r){
    if(!session || session.user.id!==owner) return;
    profile=r.data;
    if(!profile){
      var suggested=(session.user.user_metadata&&session.user.user_metadata.full_name)||(session.user.email||"").split("@")[0];
      var name=suggested;
      sb.from("profiles").insert({id:session.user.id, display_name:name}).then(function(){
        if(session && session.user.id===owner) profile={id:owner, display_name:name};
      });
    }
  });
  /* סימונים מקומיים אנונימיים נשארים נפרדים עד לבחירה מפורשת בייבוא. */
  state=loadState(activeKey()); save(); refresh();
  syncNow();
  loadMyGroup();
}

/* ---------- סנכרון התקדמות ---------- */
function noop(){}
/* ניסיון מיידי אחרי כל סימון; הגיבוי המלא הוא syncNow */
function syncChapter(book,ch,dateStr){
  if(!sb || !session) return;
  if(dateStr){
    sb.from("progress").upsert({user_id:session.user.id, book:book, chapter:ch, done_on:dateStr}).then(noop);
  } else {
    sb.from("progress").delete().match({user_id:session.user.id, book:book, chapter:ch}).then(noop);
  }
}
/* סנכרון מלא: מחיקות ממתינות -> דחיפת כל הסימונים המקומיים -> משיכת מצב השרת כמקור אמת.
   אם שלב נכשל (אופליין) השרשרת נעצרת והמצב המקומי נשמר לסנכרון הבא. */
function flushDeletes(){
  if(!sb || !session) return Promise.resolve();
  var owner=session.user.id;
  var l=getPendingDel(); if(!l.length) return Promise.resolve();
  return Promise.all(l.map(function(x){
    return sb.from("progress").delete().match({user_id:session.user.id, book:x[0], chapter:+x[1]})
      .then(function(r){ if(r.error) throw r.error; });
  })).then(function(){ if(session && session.user.id===owner) setPendingDel([]); });
}
function pushAll(){
  if(!sb || !session) return Promise.resolve();
  var rows=[];
  for(var b in state) for(var c in state[b]) rows.push({user_id:session.user.id, book:b, chapter:+c, done_on:state[b][c]});
  if(!rows.length) return Promise.resolve();
  return sb.from("progress").upsert(rows).then(function(r){ if(r.error) throw r.error; });
}
function pullReplace(){
  var owner=session&&session.user.id;
  return sb.from("progress").select("book,chapter,done_on").then(function(r){
    if(r.error) throw r.error;
    if(!session || session.user.id!==owner) return;
    var s={};
    (r.data||[]).forEach(function(row){
      if(!s[row.book]) s[row.book]={};
      s[row.book][row.chapter]=row.done_on;
    });
    state=s; save(); refresh();
  });
}
function syncNow(){
  if(!sb || !session) return Promise.resolve();
  var owner=session.user.id;
  return flushDeletes().then(function(){ if(!session || session.user.id!==owner) throw new Error("account_changed"); return pushAll(); }).then(function(){ if(!session || session.user.id!==owner) throw new Error("account_changed"); return pullReplace(); }).catch(function(){ /* אופליין - ננסה בכניסה הבאה */ });
}

/* ================= קבוצה ================= */
function makeCode(){
  var abc="ABCDEFGHJKMNPQRSTUVWXYZ23456789", s="";
  for(var i=0;i<6;i++) s+=abc[Math.floor(Math.random()*abc.length)];
  return s;
}
function loadMyGroup(){
  if(!sb || !session) return;
  var owner=session.user.id;
  sb.from("group_members").select("group_id, groups(name)").eq("user_id",session.user.id).limit(1).maybeSingle()
    .then(function(r){
      if(!session || session.user.id!==owner) return;
      myGroup = r.data ? {id:r.data.group_id, name:(r.data.groups&&r.data.groups.name)||"הקבוצה שלי"} : null;
    });
}
function renderGroup(){
  var root=$("groupRoot");
  if(!CLOUD_MODE){
    root.innerHTML='<div class="card"><h2>לימוד בקבוצה</h2>'+
      '<p>כאן תראו את חברי הקבוצה, ומי שבחר לשתף - גם את ההתקדמות שלו. '+
      'כרגע האפליקציה עובדת במצב מקומי בלבד, כי עוד לא חובר השרת המשותף.</p>'+
      '<p>החיבור הוא הפעלה חד־פעמית של מנהל האתר (חינם, בלי תשלום): יצירת פרויקט Supabase, הרצת קובץ ה־SQL, '+
      'והדבקת שני מפתחות בקובץ config.js. ההוראות המלאות צעד־אחר־צעד בקובץ README שבקוד.</p></div>';
    return;
  }
  if(!session){
    root.innerHTML='<div class="card"><h2>לימוד בקבוצה</h2>'+
      '<p>כדי ליצור קבוצה או להצטרף לאחת, מתחברים קודם עם חשבון Google.</p>'+
      '<div class="row"><button class="btn-volt" id="goSettings">להתחברות</button></div></div>';
    $("goSettings").onclick=function(){ document.querySelector('[data-view="view-settings"]').click(); };
    return;
  }
  if(!myGroup){
    root.innerHTML='<div class="card"><h2>הקבוצה שלי</h2>'+
      '<p>עוד לא בקבוצה. אפשר לפתוח קבוצה חדשה ולהזמין בקישור, או להצטרף עם קוד שקיבלת.</p>'+
      '<h3>פתיחת קבוצה חדשה</h3>'+
      '<label class="f">שם הקבוצה</label><input type="text" id="newGroupName" maxlength="40" placeholder="למשל: שיעור בוקר של שכונת נווה שרת">'+
      '<div class="row"><button class="btn-volt" id="createBtn">צור קבוצה</button></div>'+
      '<div class="hr"></div><h3>הצטרפות עם קוד</h3>'+
      '<label class="f">קוד הזמנה (6 תווים)</label><input type="text" id="joinCode" maxlength="6" placeholder="AB12CD" style="direction:ltr;text-align:left">'+
      '<div class="row"><button class="btn-volt" id="joinBtn">הצטרפות</button></div>'+
      '<div class="note">ההתקדמות שלך נשארת פרטית כברירת מחדל. רק אם תפעיל/י שיתוף - חברי הקבוצה יראו אותה, ואפשר להפסיק בכל רגע.</div></div>';
    $("createBtn").onclick=createGroup;
    $("joinBtn").onclick=function(){ joinGroup($("joinCode").value); };
    return;
  }
  root.innerHTML='<div class="card"><h2 id="gName">'+esc(myGroup.name)+'</h2><p>טוען חברים...</p></div>';
  var requestedUser=session.user.id, requestedGroup=myGroup.id;
  sb.rpc("get_group_progress",{g:myGroup.id}).then(function(r){
    if(!session || session.user.id!==requestedUser || !myGroup || myGroup.id!==requestedGroup) return;
    if(r.error){ root.innerHTML='<div class="card"><h2>'+esc(myGroup.name)+'</h2><p>שגיאה בטעינה: '+esc(r.error.message)+'</p></div>'; return; }
    renderGroupMembers(root, r.data||[]);
  });
}
function renderGroupMembers(root, rows){
  var byUser={};
  rows.forEach(function(row){
    if(!byUser[row.user_id]) byUser[row.user_id]={name:row.display_name, share:row.share_progress, joined:row.joined_at, dates:{}, chapters:0};
    if(row.done_on){ byUser[row.user_id].dates[row.done_on]=1; byUser[row.user_id].chapters++; }
  });
  var me=session.user.id, myShare=byUser[me]&&byUser[me].share;
  var invite=location.origin+location.pathname+"#join=";
  var html='<div class="card"><h2>'+esc(myGroup.name)+'</h2>'+
    '<div class="member" style="border-bottom:0;padding-top:0"><div class="mi"><b>השיתוף שלי בקבוצה</b>'+
    '<span>'+(myShare?"חברי הקבוצה רואים את ההתקדמות שלך":"פרטי - אף אחד לא רואה את ההתקדמות שלך")+'</span></div>'+
    '<label class="switch"><input type="checkbox" id="shareTgl" '+(myShare?"checked":"")+'><span class="sl"></span></label></div>'+
    '<div class="hr"></div><h3>חברי הקבוצה</h3><div id="mList">';
  var ids=Object.keys(byUser);
  if(!ids.length) html+='<p>עוד אין חברים.</p>';
  ids.forEach(function(uid){
    var m=byUser[uid], dates=m.dates;
    var dc=m.chapters, st=calcStreak(dates);
    var todayMark = dates[todayStr()] ? " · סימן/ה היום ✓" : "";
    var nums = m.share || uid===me
      ? '<div class="nums"><b>'+dc+'</b><span>פרקים</span><b>'+st+'</b><span>רצף ימים</span></div>'
      : '<span class="private-tag">לא משתף/ת</span>';
    html+='<div class="member"><div class="avatar">'+esc((m.name||"?").charAt(0))+'</div>'+
      '<div class="mi"><b>'+esc(m.name)+(uid===me?" (אני)":"")+'</b><span>'+(m.share?"משתף/ת"+todayMark:"ההתקדמות פרטית")+'</span></div>'+nums+'</div>';
  });
  html+='</div><div class="hr"></div><h3>הזמנת חברים</h3>'+
    '<p>שולחים את הקישור - מי שפותח ומתחבר מצטרף לקבוצה.</p>'+
    '<div class="invite-box" id="invLink">…</div>'+
    '<div class="row"><button class="btn-ghost" id="copyBtn">העתקת קישור</button>'+
    '<a class="btn-ghost" id="waBtn" target="_blank" rel="noopener">שיתוף בוואטסאפ</a></div>'+
    '<div class="hr"></div><div class="row"><button class="btn-danger" id="leaveBtn">עזיבת הקבוצה</button></div></div>';
  root.innerHTML=html;
  $("shareTgl").onchange=function(){
    var on=$("shareTgl").checked;
    sb.from("group_members").update({share_progress:on}).match({group_id:myGroup.id,user_id:me}).then(function(r){
      if(r.error){ toast("לא נשמר: "+r.error.message); $("shareTgl").checked=!on; return; }
      toast(on ? "השיתוף הופעל - חברי הקבוצה רואים אותך" : "השיתוף כבוי - ההתקדמות פרטית");
      renderGroup();
    });
  };
  sb.from("groups").select("invite_code").eq("id",myGroup.id).single().then(function(r){
    if(r.error||!r.data || !session || session.user.id!==me) return;
    var link=invite+r.data.invite_code;
    $("invLink").textContent=link;
    $("copyBtn").onclick=function(){
      (navigator.clipboard?navigator.clipboard.writeText(link):Promise.reject()).then(
        function(){ toast("הקישור הועתק"); },
        function(){ toast("מסומן למעלה - סמנו והעתיקו ידנית"); });
    };
    $("waBtn").href="https://wa.me/?text="+encodeURIComponent("מצטרפים ללמוד תנ״ך ביחד! נכנסים לקישור, מתחברים עם Google, וזהו: "+link);
  });
  $("leaveBtn").onclick=function(){
    if(!confirm("לעזוב את הקבוצה? ההתקדמות האישית נשמרת.")) return;
    sb.from("group_members").delete().match({group_id:myGroup.id,user_id:me}).then(function(){
      myGroup=null; renderGroup(); toast("עזבת את הקבוצה");
    });
  };
}
function createGroup(){
  var name=$("newGroupName").value.trim();
  if(!name){ toast("צריך שם לקבוצה"); return; }
  var code=makeCode();
  sb.from("groups").insert({name:name, invite_code:code, created_by:session.user.id}).select("id").single().then(function(r){
    if(r.error){ toast("לא נוצר: "+r.error.message); return; }
    sb.rpc("join_group_by_code",{code:code}).then(function(){
      myGroup={id:r.data.id, name:name}; renderGroup();
      toast("הקבוצה נוצרה! שתפו את הקישור");
    });
  });
}
function joinGroup(code){
  code=(code||"").trim();
  if(code.length<4){ toast("קוד לא תקין"); return; }
  sb.rpc("join_group_by_code",{code:code}).then(function(r){
    if(r.error){ toast(r.error.message.indexOf("group_not_found")>=0?"לא נמצאה קבוצה עם הקוד הזה":"שגיאה: "+r.error.message); return; }
    sb.from("groups").select("name").eq("id",r.data).single().then(function(g){
      myGroup={id:r.data, name:(g.data&&g.data.name)||"הקבוצה שלי"};
      renderGroup(); toast("הצטרפת לקבוצה!");
    });
  });
}

/* קישור הצטרפות שהגיע בכתובת (#join=CODE) */
function handleJoinLink(){
  var m=(location.hash||"").match(/join=([A-Za-z0-9]{4,8})/);
  if(!m) return;
  history.replaceState(null,"",location.pathname);
  localStorage.setItem("shnaim-pending-join", m[1]);
}
handleJoinLink();
window.addEventListener("hashchange",function(){ handleJoinLink(); consumePendingJoin(); });
function consumePendingJoin(){
  var code=localStorage.getItem("shnaim-pending-join");
  if(code && session){ localStorage.removeItem("shnaim-pending-join"); joinGroup(code); }
}

/* ================= אתחול ================= */
refresh();
if(doneCount()>0 && nextBook){
  var nb=document.querySelector('.book[data-name="'+nextBook+'"]'); if(nb) nb.classList.add("open");
}
scheduleReminder();
var mg=$("mainGoogleBtn"); if(mg && CLOUD_MODE) mg.href=CFG.SUPABASE_URL+"/auth/v1/authorize?provider=google&redirect_to="+encodeURIComponent(location.origin+location.pathname);
if("serviceWorker" in navigator && location.protocol==="https:"){
  navigator.serviceWorker.register("sw.js").catch(noop);
}
(function(){
  var q=new URLSearchParams(location.hash.slice(1));
  if(q.get("error")||q.get("error_description")){
    var msg=q.get("error_description")||q.get("error");
    toast("הכניסה לא הושלמה: "+msg);
    history.replaceState(null,"",location.pathname);
    document.querySelector('[data-view="view-settings"]').click();
  }
})();
initCloud();
/* אחרי התחברות - להשלים הצטרפות מקישור */
var _onLoggedIn=onLoggedIn;
onLoggedIn=function(){ _onLoggedIn(); consumePendingJoin(); };
})();
