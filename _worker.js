// 映像シート v2 — ヘッダ強化 + 診断情報付き
// Cloudflare Pages 用 _worker.js (UI + 取得API)

const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "ja-JP,ja;q=0.9",
  "cache-control": "no-cache",
  pragma: "no-cache",
  referer: "https://race.netkeiba.com/top/",
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "same-origin",
  "upgrade-insecure-requests": "1",
};

export default {
  async fetch(req) {
    const u = new URL(req.url);
    if (u.pathname === "/api") return api(u);
    if (u.pathname === "/manifest.json") return manifest();
    return new Response(PAGE, {
      headers: { "content-type": "text/html;charset=utf-8" },
    });
  },
};

/* ---------- API ---------- */

async function api(u) {
  try {
    const raw = u.searchParams.get("q") || "";
    const m = raw.match(/(\d{12})/);
    if (!m) return json({ error: "URLかrace_id(12桁)が読み取れなかった" }, 400);
    const raceId = m[1];

    const target = `https://race.netkeiba.com/race/shutuba_past.html?race_id=${raceId}`;
    const res = await fetch(target, { headers: HEADERS, redirect: "follow" });
    const html = await res.text();

    if (!res.ok) {
      // 診断: ステータスと本文の先頭を返す
      const snippet = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 200);
      return json(
        { error: `netkeiba応答 ${res.status} / 本文冒頭: ${snippet}` },
        502
      );
    }

    let title = "";
    const t = html.match(/<title>([^<]+)<\/title>/);
    if (t) title = t[1].replace(/\s*5走表示\s*/, " ").split(" レース情報")[0].trim();

    let rows = html.split(/<tr[^>]*class="[^"]*HorseList[^"]*"[^>]*>/).slice(1);
    if (rows.length === 0) {
      rows = html.split(/<tr\b/).filter((r) => r.includes("movie.html?race_id="));
    }
    if (rows.length === 0) {
      const snippet = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 200);
      return json({ error: `馬の行が見つからない / 本文冒頭: ${snippet}` }, 502);
    }

    const horses = rows.map((row, i) => {
      const wakuM = row.match(/Waku(\d)/);
      const numM = row.match(/class="[^"]*Umaban[^"]*"[^>]*>\s*(\d+)/);
      const nameM =
        row.match(/HorseName[^>]*>\s*<a[^>]*title="([^"]+)"/) ||
        row.match(/db\.netkeiba\.com\/horse\/\d+[^>]*>([^<!][^<]*)<\/a>/);

      const runs = [];
      for (const cell of row.split(/<td/)) {
        const mv = cell.match(/movie\.html\?race_id=(\d{12})/);
        if (!mv) continue;
        const text = cell
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/\s+/g, " ");
        const head = text.match(/(\d{4}\.\d{2}\.\d{2})\s+(\S+)\s+(\d{1,2})\b/);
        const rn = cell.match(/db\.netkeiba\.com\/race\/\d+[^>]*>([^<]+)</);
        const course = text.match(/([芝ダ障]{1,2}\s?\d{3,4}[^\s]*)/);
        runs.push({
          date: head ? head[1].slice(2) : "",
          venue: head ? head[2] : "",
          fin: head ? +head[3] : null,
          name: rn ? rn[1].trim() : "レース",
          course: course ? course[1] : "",
          movie: `https://race.netkeiba.com/race/movie.html?race_id=${mv[1]}`,
        });
      }

      return {
        waku: wakuM ? +wakuM[1] : 0,
        num: numM ? +numM[1] : i + 1,
        name: nameM ? nameM[1].trim() : `${i + 1}番`,
        runs,
      };
    });

    return json({ raceId, title, horses });
  } catch (e) {
    return json({ error: "解析に失敗: " + e.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json;charset=utf-8" },
  });
}

function manifest() {
  return json({
    name: "映像シート",
    short_name: "映像シート",
    start_url: "/",
    display: "standalone",
    background_color: "#0c1512",
    theme_color: "#0c1512",
  });
}

/* ---------- UI ---------- */

const PAGE = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="manifest" href="/manifest.json">
<title>映像シート</title>
<style>
:root{
  --bg:#0c1512; --panel:#13201b; --line:#22352d; --ink:#e8efe9; --sub:#8fa79b;
  --amber:#f5b32b; --amber-ink:#1a1204;
  --w1:#f2f2ee;--w2:#1a1a1a;--w3:#d8382e;--w4:#1f5fc4;--w5:#e8c227;--w6:#2e9e4f;--w7:#e07820;--w8:#e88fb0;
}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font-family:"Hiragino Kaku Gothic ProN","Hiragino Sans",system-ui,sans-serif;font-size:15px;line-height:1.5;padding:0 0 60px;padding-top:env(safe-area-inset-top)}
header{padding:18px 14px 12px;border-bottom:1px solid var(--line)}
h1{font-size:18px;font-weight:700}
h1 span{color:var(--amber);font-family:monospace;font-size:12px;letter-spacing:.1em;display:block}
.input-row{display:flex;gap:8px;margin:12px 14px 0}
input[type=text]{flex:1;background:var(--panel);border:1px solid var(--line);border-radius:8px;color:var(--ink);padding:11px 12px;font-size:15px}
button{background:var(--amber);color:var(--amber-ink);border:none;border-radius:8px;font-weight:700;font-size:14px;padding:0 16px}
button:active{transform:scale(.96)}
#status{margin:10px 14px;color:var(--sub);font-size:13px;word-break:break-all}
#hist{margin:6px 14px 0;display:flex;flex-wrap:wrap;gap:6px}
.chip{background:var(--panel);border:1px solid var(--line);border-radius:99px;color:var(--sub);font-size:12px;padding:6px 11px}
#race-title{margin:14px 14px 0;font-size:16px;font-weight:700}
main{padding:10px 10px 0;display:grid;gap:10px}
.horse{background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden;border-left:5px solid var(--wc,var(--line))}
.hh{display:flex;align-items:center;gap:9px;padding:9px 11px;border-bottom:1px solid var(--line)}
.num{min-width:32px;height:32px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-family:monospace;font-weight:700;font-size:16px;background:var(--wc);color:var(--nc,#111);border:1px solid rgba(255,255,255,.15)}
.hname{font-size:16px;font-weight:700}
.run{display:flex;align-items:center;gap:9px;padding:8px 11px;border-bottom:1px solid var(--line)}
.run:last-child{border-bottom:none}
.date{font-family:monospace;font-size:12px;color:var(--sub);min-width:56px;white-space:nowrap}
.fin{font-family:monospace;font-weight:700;font-size:14px;min-width:36px;white-space:nowrap}
.fin.win{color:var(--amber)}
.desc{flex:1;min-width:0}
.rname{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}
.rmeta{font-size:11px;color:var(--sub)}
.play{flex-shrink:0;background:var(--amber);color:var(--amber-ink);text-decoration:none;font-size:12px;font-weight:700;padding:8px 11px;border-radius:7px;white-space:nowrap}
.norun{padding:9px 11px;color:var(--sub);font-size:12.5px}
</style>
</head>
<body>
<header>
  <h1><span>EIZO SHEET</span>出馬表 → 過去レース映像</h1>
  <div class="input-row">
    <input type="text" id="q" placeholder="出馬表URL か race_id を貼る" inputmode="text" autocomplete="off">
    <button onclick="go()">生成</button>
  </div>
  <div id="hist"></div>
</header>
<div id="status"></div>
<div id="race-title"></div>
<main id="sheet"></main>
<script>
const W={1:["var(--w1)","#111"],2:["var(--w2)","#fff"],3:["var(--w3)","#fff"],4:["var(--w4)","#fff"],5:["var(--w5)","#111"],6:["var(--w6)","#fff"],7:["var(--w7)","#fff"],8:["var(--w8)","#111"],0:["var(--line)","#fff"]};
const $=id=>document.getElementById(id);

function hist(){try{return JSON.parse(localStorage.getItem("es_hist")||"[]")}catch(e){return[]}}
function pushHist(id,title){
  const h=hist().filter(x=>x.id!==id);
  h.unshift({id,title});
  localStorage.setItem("es_hist",JSON.stringify(h.slice(0,12)));
  renderHist();
}
function renderHist(){
  $("hist").innerHTML=hist().map(x=>
    '<button class="chip" onclick="load(\\''+x.id+'\\')">'+(x.title||x.id)+'</button>').join("");
}

async function go(){ load($("q").value); }

async function load(q){
  if(!q) return;
  $("status").textContent="取得中…";
  $("sheet").innerHTML=""; $("race-title").textContent="";
  try{
    const r=await fetch("/api?q="+encodeURIComponent(q));
    const d=await r.json();
    if(d.error){ $("status").textContent="エラー: "+d.error; return; }
    $("status").textContent="";
    $("race-title").textContent=d.title||d.raceId;
    pushHist(d.raceId,(d.title||"").split("|")[1]?.trim()||d.title);
    $("sheet").innerHTML=d.horses.map(h=>{
      const[wc,nc]=W[h.waku]||W[0];
      const rows=h.runs.length?h.runs.map(r=>
        '<div class="run">'+
        '<span class="date">'+r.date+'</span>'+
        '<span class="fin'+(r.fin&&r.fin<=3?" win":"")+'">'+(r.fin??"-")+'着</span>'+
        '<span class="desc"><span class="rname">'+r.venue+" "+r.name+'</span>'+
        '<span class="rmeta">'+r.course+'</span></span>'+
        '<a class="play" href="'+r.movie+'" target="_blank" rel="noopener">▶ 映像</a></div>'
      ).join(""):'<div class="norun">過去走なし(新馬など)</div>';
      return '<section class="horse" style="--wc:'+wc+';--nc:'+nc+'">'+
        '<div class="hh"><span class="num">'+h.num+'</span>'+
        '<span class="hname">'+h.name+'</span></div>'+rows+'</section>';
    }).join("");
  }catch(e){ $("status").textContent="通信エラー: "+e.message; }
}
renderHist();
</script>
</body>
</html>`;
