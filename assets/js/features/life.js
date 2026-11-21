"use strict";
(()=>{
 const endpoint="https://flat-star-50c3.rkabiitex.workers.dev/";
 const form=document.getElementById("lifeChatForm"),input=document.getElementById("lifeChatInput"),send=document.getElementById("lifeChatSend"),messages=document.getElementById("lifeMessages");
 if(!form||!input||!send||!messages)return;
 let history=[];
 function addMessage(role,text){
  const bubble=document.createElement("div");bubble.className="life-message "+role;bubble.textContent=text;messages.append(bubble);messages.scrollTop=messages.scrollHeight;
 }
 function clearWelcome(){const welcome=messages.querySelector(".life-welcome");if(welcome)welcome.remove();}
 async function ask(text){
  const prompt=String(text||"").trim();if(!prompt||send.disabled)return;
  clearWelcome();addMessage("user",prompt);history.push({role:"user",content:prompt});
  input.value="";send.disabled=true;send.textContent="Thinking…";
  try{
   if(typeof window.vextGetAccessToken!=="function")throw new Error("Please sign in to use VEXT LIFE.");
   const token=await window.vextGetAccessToken();
   const system="You are VEXT LIFE, a thoughtful personal AI assistant for individuals, students and professionals. Help with learning, research, planning, writing, career preparation and personal productivity. Be clear, practical and encouraging without making guarantees. Do not assume access to the user's personal files, accounts or private information. Ask before treating assumptions as facts. Keep business workspace information out of this conversation. The user wants a useful, direct answer.";
   const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({message:system+"\n\nUser request: "+prompt,maxOutputTokens:1800,history:[]})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||("AI request failed ("+response.status+")"));
   const reply=typeof data.reply==="string"?data.reply.trim():(typeof data.output_text==="string"?data.output_text.trim():"");
   if(!reply)throw new Error("The AI service returned an empty response.");
   addMessage("assistant",reply);
  }catch(error){addMessage("assistant","I couldn't complete that request. "+(error.message||"Please try again."));}
  finally{send.disabled=false;send.textContent="Send →";input.focus();}
 }
 form.addEventListener("submit",event=>{event.preventDefault();void ask(input.value);});
 messages.addEventListener("click",event=>{const button=event.target.closest("[data-life-prompt]");if(button)void ask(button.dataset.lifePrompt);});
 input.addEventListener("keydown",event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();form.requestSubmit();}});
})();
