// 블로그 주인 전용 기능이 GitHub에 글을 저장할 때 쓰는 도우미입니다.
// 토큰은 이 브라우저(localStorage)에만 저장됩니다.
window.GH = (function () {
  var b = document.body;
  var USER = b.getAttribute("data-user");
  var REPO = b.getAttribute("data-repo");
  var BRANCH = b.getAttribute("data-branch") || "main";
  var TOKEN_KEY = "blog-token";

  function token() { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } }
  function setToken(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) {} }

  function encPath(p) { return p.split("/").map(encodeURIComponent).join("/"); }

  function api(path, opts) {
    opts = opts || {};
    return fetch("https://api.github.com/repos/" + USER + "/" + REPO + path, {
      method: opts.method || "GET",
      headers: { "Authorization": "Bearer " + token(), "Accept": "application/vnd.github+json" },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store"
    }).then(function (r) {
      if (!r.ok) { var e = new Error("HTTP " + r.status); e.status = r.status; throw e; }
      return r.status === 204 ? null : r.json();
    });
  }

  function b64encode(str) {
    var bytes = new TextEncoder().encode(str), bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function b64decode(s) {
    var bin = atob(s.replace(/\s/g, "")), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  // 파일 하나 읽기 → { path, text }
  function readFile(path) {
    return api("/contents/" + encPath(path) + "?ref=" + BRANCH).then(function (d) {
      return { path: path, text: b64decode(d.content) };
    });
  }

  // 폴더 안 파일 이름 목록 (폴더가 없으면 빈 목록)
  function listDir(dir) {
    return api("/contents/" + encPath(dir) + "?ref=" + BRANCH).then(function (items) {
      return items.filter(function (i) { return i.type === "file"; }).map(function (i) { return i.path; });
    }, function (e) { if (e.status === 404) return []; throw e; });
  }

  // 여러 파일을 한 번에 저장/삭제 (커밋 하나)
  // changes: [{ path, content }] 또는 [{ path, remove: true }]
  function commit(changes, message) {
    var head;
    return api("/git/ref/heads/" + BRANCH)
      .then(function (r) { head = r.object.sha; return api("/git/commits/" + head); })
      .then(function (c) {
        return api("/git/trees", { method: "POST", body: {
          base_tree: c.tree.sha,
          tree: changes.map(function (ch) {
            return ch.remove
              ? { path: ch.path, mode: "100644", type: "blob", sha: null }
              : { path: ch.path, mode: "100644", type: "blob", content: ch.content };
          })
        }});
      })
      .then(function (t) { return api("/git/commits", { method: "POST", body: { message: message, tree: t.sha, parents: [head] } }); })
      .then(function (c) { return api("/git/refs/heads/" + BRANCH, { method: "PATCH", body: { sha: c.sha } }); });
  }

  // ── 머리말(front matter) 다루기 ──
  function parse(text) {
    var m = text.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?([\s\S]*)$/);
    return {
      front: m ? m[1].split(/\r?\n/) : [],
      body: (m ? m[2] : text).replace(/^(\r?\n)+/, "").replace(/\s+$/, "")
    };
  }
  function get(front, key) {
    for (var i = 0; i < front.length; i++) {
      var m = front[i].match(new RegExp("^" + key + ":\\s*(.*)$"));
      if (m) {
        var v = m[1].trim();
        if (v.charAt(0) === '"') { try { return JSON.parse(v); } catch (e) {} }
        return v.replace(/^['"]|['"]$/g, "");
      }
    }
    return "";
  }
  function set(front, key, value) {
    var line = key + ": " + (typeof value === "string" ? quote(value) : value);
    for (var i = 0; i < front.length; i++) {
      if (new RegExp("^" + key + ":").test(front[i])) { front[i] = line; return front; }
    }
    front.push(line);
    return front;
  }
  function quote(s) { return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"'; }
  function build(front, body) { return "---\n" + front.join("\n") + "\n---\n" + (body ? "\n" + body + "\n" : ""); }

  function message(e) {
    if (!e || !e.status) return "인터넷 연결을 확인해 주세요.";
    if (e.status === 401) return "토큰이 맞지 않거나 만료됐어요. 글쓰기 화면의 연결 설정을 확인해 주세요.";
    if (e.status === 403 || e.status === 404) return "토큰에 이 저장소 쓰기 권한이 없어요.";
    if (e.status === 409 || e.status === 422) return "그 사이 저장소가 바뀌었어요. 잠시 뒤 다시 시도해 주세요.";
    return "GitHub 오류가 났어요 (" + e.status + ").";
  }

  function newSlug(prefix) { return prefix + "-" + Date.now().toString(36); }

  return {
    USER: USER, REPO: REPO, BRANCH: BRANCH,
    token: token, setToken: setToken,
    readFile: readFile, listDir: listDir, commit: commit,
    parse: parse, get: get, set: set, quote: quote, build: build,
    message: message, newSlug: newSlug
  };
})();
