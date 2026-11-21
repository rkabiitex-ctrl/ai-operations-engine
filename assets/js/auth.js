(()=>{ "use strict";
 const client=window.supabase.createClient("https://nakydtwssxlbtpocxmwh.supabase.co","sb_publishable_jOxJl50SORuiYbTZ2Gq7yw_KiySZ56e");
 const gate=document.getElementById("vextAuthGate"),form=document.getElementById("vextAuthForm"),email=document.getElementById("vextAuthEmail"),password=document.getElementById("vextAuthPassword"),message=document.getElementById("vextAuthMessage"),submit=document.getElementById("vextAuthSubmit");let mode="signin";
 function say(t,bad=false){message.textContent=t;message.style.color=bad?"#ffaaa5":"#9de7d3"}
 function setMode(m){mode=m;const up=m==="signup";document.getElementById("vextAuthHeading").textContent=up?"Create your account":"Welcome back";document.getElementById("vextAuthIntro").textContent=up?"Create a secure account to access your VEXT AI workspace.":"Sign in to access your VEXT AI workspace.";submit.textContent=up?"Create account":"Sign in";document.getElementById("vextAuthSwitchText").textContent=up?"Already have an account?":"New to VEXT AI?";document.getElementById("vextAuthSwitch").textContent=up?"Sign in":"Create an account";document.getElementById("vextAuthForgot").hidden=up;password.autocomplete=up?"new-password":"current-password";say("")}
 function showUser(user){let box=document.getElementById("vextAuthActions");if(!box){box=document.createElement("div");box.id="vextAuthActions";document.querySelector(".top-actions")?.appendChild(box)}if(box){box.replaceChildren();const who=document.createElement("span");who.id="vextAuthUser";who.textContent=user.email||"Signed in";const out=document.createElement("button");out.id="vextAuthLogout";out.type="button";out.textContent="Sign out";out.onclick=async()=>{const {error}=await client.auth.signOut();if(error)alert(error.message)};box.append(who,out)}}
 window.vextGetAccessToken=async function(){const {data,error}=await client.auth.getSession();if(error)throw error;if(!data.session?.access_token)throw new Error("Your session has expired. Please sign in again.");return data.session.access_token};
 async function apply(session){
  if(session){
   gate.hidden=false;
   showUser(session.user);
   try{await window.vextActivateUserData?.(session.user);gate.hidden=true}
   catch(error){gate.hidden=false;say("Could not load your secure workspace: "+(error.message||"Please refresh and try again."),true)}
  }else{
   window.vextDeactivateUserData?.();
   gate.hidden=false;
   document.getElementById("vextAuthActions")?.remove();
  }
 }
 document.getElementById("vextAuthSwitch").onclick=()=>setMode(mode==="signin"?"signup":"signin");

  const startSignup=()=>{setMode("signup");document.getElementById("vextAuthEmail").focus();document.getElementById("vextAuthCard").scrollIntoView({behavior:"smooth",block:"center"})};
  const startLogin=()=>{setMode("signin");document.getElementById("vextAuthEmail").focus();document.getElementById("vextAuthCard").scrollIntoView({behavior:"smooth",block:"center"})};
  ["vextLandingSignup","vextHeroSignup"].forEach(id=>document.getElementById(id).addEventListener("click",startSignup));
  ["vextLandingLogin","vextHeroLogin"].forEach(id=>document.getElementById(id).addEventListener("click",startLogin));
  document.getElementById("landingYear").textContent=new Date().getFullYear();

 form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;submit.textContent=mode==="signup"?"Creating account…":"Signing in…";say("");try{let result;if(mode==="signup"){result=await client.auth.signUp({email:email.value.trim(),password:password.value,options:{emailRedirectTo:location.origin+location.pathname}});if(result.error)throw result.error;say(result.data.session?"Account created. Opening workspace…":"Account created. Check your email and confirm your address before signing in.")}else{result=await client.auth.signInWithPassword({email:email.value.trim(),password:password.value});if(result.error)throw result.error;say("Signed in successfully.")}}catch(err){say(err.message||"Please try again.",true)}finally{submit.disabled=false;submit.textContent=mode==="signup"?"Create account":"Sign in"}};
 document.getElementById("vextAuthForgot").onclick=async()=>{const mail=email.value.trim();if(!mail){say("Enter your email address first.",true);email.focus();return}say("Sending reset email…");const {error}=await client.auth.resetPasswordForEmail(mail,{redirectTo:location.origin+location.pathname});say(error?error.message:"If an account exists, a password reset email has been sent.",!!error)};
 client.auth.onAuthStateChange((_event,session)=>{void apply(session)});client.auth.getSession().then(({data,error})=>{if(error)say(error.message,true);void apply(data?.session||null)});
})();
