/** Inline script — runs before React hydrates so chunk/RSC errors still trigger reload. */
export const chunkLoadRecoveryScript = `(function(){
  var k="d2q-chunk-reload",c="d2q-chunk-reload-count",max=2,delay=3000;
  function isRecoverable(m){
    return /ChunkLoadError|Failed to load chunk|Loading chunk [\\w-]+ failed|Unexpected end of JSON input|Failed to fetch RSC payload/i.test(m);
  }
  function reload(m){
    if(!isRecoverable(m))return;
    var n=Number(sessionStorage.getItem(c)||"0");
    if(n>=max||sessionStorage.getItem(k)==="pending")return;
    sessionStorage.setItem(k,"pending");
    sessionStorage.setItem(c,String(n+1));
    setTimeout(function(){
      var u=new URL(location.href);
      u.searchParams.set("_cb",String(Date.now()));
      location.replace(u.toString());
    },delay);
  }
  window.addEventListener("error",function(e){reload(String((e.error&&e.error.message)||e.message||""));});
  window.addEventListener("unhandledrejection",function(e){
    var r=e.reason;
    reload(r&&r.message?r.message:String(r||""));
  });
  window.addEventListener("load",function(){
    sessionStorage.removeItem(k);
    sessionStorage.removeItem(c);
    var u=new URL(location.href);
    if(u.searchParams.has("_cb")){
      u.searchParams.delete("_cb");
      history.replaceState({}, "", u.toString());
    }
  });
})();`;
