"use strict";
(() => {
 const SOURCE_LABELS={manual:"Owner note",website:"Website",document:"Document",meeting:"Meeting",other:"Other source"};
 function init(config){
  const $=config.$;
  let entries=[],busy=false;
  const businessId=()=>String(config.getBusinessId()||"");
  const status=(message,bad=false)=>{const el=$("memoryStatus");if(el){el.textContent=message;el.classList.toggle("error",bad)}};
  async function request(path,method="GET",body=null){
   const token=await config.getAccessToken();
   const response=await fetch(config.endpoint+"api/admin/business-memory"+path,{method,headers:{"Authorization":"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||("Request failed ("+response.status+")"));
   return data;
  }
  function resetForm(){
   $("memoryEntryId").value="";$("memoryTitle").value="";$("memorySourceType").value="manual";$("memorySourceLabel").value="";$("memoryContent").value="";
   $("memoryEditorTitle").textContent="Add a knowledge note";$("memorySaveButton").textContent="Save knowledge";$("memoryCancelEdit").hidden=true;
  }
  function editEntry(entry){
   $("memoryEntryId").value=entry.id;$("memoryTitle").value=entry.title||"";$("memorySourceType").value=entry.source_type||"manual";$("memorySourceLabel").value=entry.source_label||"";$("memoryContent").value=entry.content||"";
   $("memoryEditorTitle").textContent="Edit knowledge note";$("memorySaveButton").textContent="Update knowledge";$("memoryCancelEdit").hidden=false;
   $("memoryTitle").focus();status("Editing: "+(entry.title||"Knowledge note"));
  }
  function renderList(){
   const list=$("memoryList"),count=$("memoryCount"),deleteAll=$("memoryDeleteAll");
   list.replaceChildren();count.textContent=entries.length+" "+(entries.length===1?"entry":"entries");deleteAll.disabled=busy||entries.length===0;
   $("memoryLibraryHint").textContent=entries.length?"Only this business owner's entries are listed.":"No saved knowledge yet.";
   if(!entries.length){const empty=document.createElement("div");empty.className="memory-empty";empty.textContent="No entries yet. Add your first business fact, policy or reference note.";list.append(empty);return;}
   entries.forEach(entry=>{
    const card=document.createElement("article");card.className="memory-entry";
    const head=document.createElement("div");head.className="memory-entry-head";
    const identity=document.createElement("div"),title=document.createElement("h4");title.textContent=entry.title||"Untitled";
    const source=document.createElement("small");source.textContent=(SOURCE_LABELS[entry.source_type]||"Source")+" · "+(entry.source_label||"No source label");identity.append(title,source);
    const updated=document.createElement("small");updated.className="memory-entry-date";updated.textContent=entry.updated_at?"Updated "+new Date(entry.updated_at.replace(" ","T")+"Z").toLocaleDateString():"Saved";
    head.append(identity,updated);card.append(head);
    const content=document.createElement("p");content.textContent=entry.content||"";card.append(content);
    const actions=document.createElement("div");actions.className="memory-entry-actions";
    const edit=document.createElement("button");edit.type="button";edit.className="secondary";edit.dataset.memoryEdit=entry.id;edit.textContent="Edit";
    const del=document.createElement("button");del.type="button";del.className="secondary";del.dataset.memoryDelete=entry.id;del.textContent="Delete";
    actions.append(edit,del);card.append(actions);list.append(card);
   });
  }
  async function render(){
   const id=businessId();$("memoryDeleteAll").disabled=true;
   if(!id){entries=[];renderList();$("memoryLibraryHint").textContent="Save your Sales Agent business profile first.";status("Business profile not configured.",true);return;}
   $("memoryLibraryHint").textContent="Loading knowledge for "+(config.getBusinessName()||"your business")+"…";
   try{const data=await request("?businessId="+encodeURIComponent(id));entries=Array.isArray(data.entries)?data.entries:[];renderList();status("Business Memory synced from your private workspace.");}
   catch(error){entries=[];renderList();status(error.message||"Could not load Business Memory.",true);}
  }
  $("memoryForm").addEventListener("submit",async event=>{
   event.preventDefault();if(busy)return;
   const id=businessId();if(!id){status("Save your Sales Agent business profile first.",true);return;}
   const entryId=$("memoryEntryId").value;
   const body={businessId:id,id:entryId,title:$("memoryTitle").value.trim(),content:$("memoryContent").value.trim(),sourceType:$("memorySourceType").value,sourceLabel:$("memorySourceLabel").value.trim()};
   if(!body.title||!body.content){status("Enter a title and knowledge content.",true);return;}
   busy=true;$("memorySaveButton").disabled=true;status(entryId?"Updating knowledge…":"Saving knowledge…");
   try{await request("", "POST",body);resetForm();await render();status("Business Memory saved securely.");}
   catch(error){status(error.message||"Could not save knowledge.",true);}
   finally{busy=false;$("memorySaveButton").disabled=false;renderList();}
  });
  $("memoryCancelEdit").addEventListener("click",()=>{resetForm();status("Edit cancelled.");});
  $("memoryList").addEventListener("click",async event=>{
   const edit=event.target.closest("[data-memory-edit]"),del=event.target.closest("[data-memory-delete]");
   if(edit){const entry=entries.find(item=>item.id===edit.dataset.memoryEdit);if(entry)editEntry(entry);return;}
   if(del){const entry=entries.find(item=>item.id===del.dataset.memoryDelete);if(!entry||!confirm("Delete this Business Memory entry? This cannot be undone."))return;
    busy=true;renderList();status("Deleting knowledge…");
    try{await request("?businessId="+encodeURIComponent(businessId())+"&id="+encodeURIComponent(entry.id),"DELETE");entries=entries.filter(item=>item.id!==entry.id);if($("memoryEntryId").value===entry.id)resetForm();renderList();status("Entry deleted.");}
    catch(error){status(error.message||"Could not delete entry.",true);}
    finally{busy=false;renderList();}
   }
  });
  $("memoryDeleteAll").addEventListener("click",async()=>{
   if(busy||!entries.length||!confirm("Delete all "+entries.length+" Business Memory entries for this business? This cannot be undone."))return;
   busy=true;renderList();status("Deleting all business knowledge…");
   try{await request("?businessId="+encodeURIComponent(businessId())+"&all=true","DELETE");entries=[];resetForm();renderList();status("All Business Memory entries deleted.");}
   catch(error){status(error.message||"Could not delete all entries.",true);}
   finally{busy=false;renderList();}
  });
  return Object.freeze({render});
 }
 window.VEXTBusinessMemory=Object.freeze({init});
})();
