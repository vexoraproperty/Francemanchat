(function () {
  if (window.__fmChatLoaded) return;
  window.__fmChatLoaded = true;
  var script = document.currentScript;
  var origin = new URL(script.src).origin;
  var frame = document.createElement("iframe");
  frame.src = origin + "/widget";
  frame.title = "Franceman live chat";
  frame.setAttribute("allowtransparency", "true");
  frame.style.cssText = "position:fixed;bottom:0;right:0;width:104px;height:104px;border:0;z-index:2147483000;background:transparent;color-scheme:normal;";
  document.body.appendChild(frame);
  var last = "";
  function sendPage() {
    if (!frame.contentWindow) return;
    frame.contentWindow.postMessage({ type: "fm:page", url: location.href, title: document.title, referrer: document.referrer }, origin);
  }
  setInterval(function () {
    if (location.href !== last) { last = location.href; sendPage(); }
  }, 1000);
  window.addEventListener("message", function (e) {
    if (e.origin !== origin || !e.data) return;
    if (e.data.type === "fm:ready") { last = location.href; sendPage(); }
    if (e.data.type === "fm:state") {
      var mobile = window.innerWidth < 640;
      if (e.data.open) {
        frame.style.width = mobile ? "100%" : "420px";
        frame.style.height = mobile ? "100%" : "min(720px, 100vh)";
      } else {
        frame.style.width = "104px";
        frame.style.height = "104px";
      }
    }
  });
})();
