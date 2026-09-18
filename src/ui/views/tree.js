/**
 * 视图：世系图（Canvas 2D）
 * 分层布局（Reingold-Tilford 简化版）+ 缩放 / 拖拽 / 点选 / 双击详情
 * 千级节点全量 Canvas 绘制，无 DOM 压力。
 */
(function (global) {
  'use strict';
  var ZP = (global.ZP = global.ZP || {});
  var ui = ZP.ui, S = ZP.schema, L = ZP.lineage;
  var views = (ZP.views = ZP.views || {});

  var NODE_W = 116, NODE_H = 44, COL_GAP = 20, ROW_GAP = 76;

  var view = {
    state: null,
    canvas: null,
    ctx: null,
    dpr: 1,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    nodes: [],
    selectedId: null,
    dragging: false,
    moved: false,
    _bound: false
  };

  var COLORS = {
    line: '#c9bfae',
    nodeBg: '#ffffff',
    nodeLine: '#d2cabc',
    nodeLineSel: '#a63f36',
    ink: '#26241f',
    ink3: '#8a8177',
    clan: '#2f7d5b',
    out: '#a97a1f',
    external: '#9a9186',
    spouse: '#a63f36',
    shadow: 'rgba(38,36,31,.08)'
  };

  /* ───────── 入口 ───────── */

  function render(container, state) {
    view.state = state;
    view.selectedId = null;

    container.innerHTML =
      '<div class="tree-wrap">' +
        '<canvas class="tree-canvas" id="treeCanvas"></canvas>' +
        '<div class="tree-legend">' +
          '<div><span class="dot" style="background:' + COLORS.clan + '"></span>本宗</div>' +
          '<div><span class="dot" style="background:' + COLORS.out + '"></span>外嫁女</div>' +
          '<div><span class="dot" style="background:' + COLORS.external + '"></span>外系</div>' +
          '<div><span class="dot" style="background:' + COLORS.spouse + '"></span>配偶（节点内附注）</div>' +
          '<div class="muted" style="margin-top:4px">滚轮缩放 · 拖拽平移 · 点击选中 · 双击详情</div>' +
        '</div>' +
        '<div class="tree-hud">' +
          '<button class="btn btn-sm" id="treeFit">适应</button>' +
          '<button class="btn btn-sm" id="treeZoomOut">－</button>' +
          '<button class="btn btn-sm" id="treeZoomIn">＋</button>' +
          '<button class="btn btn-sm" id="treeReset">原始</button>' +
        '</div>' +
      '</div>';

    var roots = state.genesis || [];
    if (!roots.length) {
      container.querySelector('.tree-wrap').innerHTML =
        '<div class="empty"><div class="big">🌱</div><p>暂无可展示的世系数据，请先在「成员管理」中录入成员</p></div>';
      return;
    }

    view.canvas = ui.$('#treeCanvas');
    view.ctx = view.canvas.getContext('2d');

    layout(roots);
    bindInteractions();
    resize();
    fitView();
  }

  /* ───────── 布局 ───────── */

  function layout(roots) {
    var cursor = 0;
    var out = [];
    function walk(node, depth) {
      node._depth = depth;
      if (!node.children || !node.children.length) {
        node._x = cursor++;
      } else {
        node.children.forEach(function (c) { walk(c, depth + 1); });
        node._x = (node.children[0]._x + node.children[node.children.length - 1]._x) / 2;
      }
      out.push(node);
    }
    roots.forEach(function (r) { walk(r, 0); });
    view.nodes = out;
  }

  function nodeRect(node) {
    return {
      x: node._x * (NODE_W + COL_GAP),
      y: node._depth * (NODE_H + ROW_GAP),
      w: NODE_W,
      h: NODE_H
    };
  }

  /* ───────── 绘制 ───────── */

  function resize() {
    if (!view.canvas) return;
    var wrap = view.canvas.parentElement;
    var w = wrap.clientWidth, h = wrap.clientHeight;
    view.dpr = window.devicePixelRatio || 1;
    view.canvas.width = Math.round(w * view.dpr);
    view.canvas.height = Math.round(h * view.dpr);
    draw();
  }

  function draw() {
    var ctx = view.ctx;
    if (!ctx) return;
    var w = view.canvas.width, h = view.canvas.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    var d = view.dpr;
    ctx.setTransform(d * view.scale, 0, 0, d * view.scale, d * view.offsetX, d * view.offsetY);

    // 连线
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 1.2;
    view.nodes.forEach(function (node) {
      node.children.forEach(function (child) {
        var a = nodeRect(node), b = nodeRect(child);
        var ax = a.x + a.w / 2, ay = a.y + a.h;
        var bx = b.x + b.w / 2, by = b.y;
        var midY = ay + (by - ay) / 2;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax, midY);
        ctx.lineTo(bx, midY);
        ctx.lineTo(bx, by);
        ctx.stroke();
      });
    });

    // 节点
    view.nodes.forEach(function (node) { drawNode(ctx, node); });
  }

  function drawNode(ctx, node) {
    var r = nodeRect(node);
    var p = node.person;
    var selected = node.id === view.selectedId;

    ctx.save();

    // 卡片底 + 阴影
    ctx.save();
    ctx.shadowColor = COLORS.shadow;
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    roundRect(ctx, r.x, r.y, r.w, r.h, 6);
    ctx.fillStyle = COLORS.nodeBg;
    ctx.fill();
    ctx.restore();

    // 边框
    ctx.lineWidth = selected ? 2 : 1;
    ctx.strokeStyle = selected ? COLORS.nodeLineSel : COLORS.nodeLine;
    roundRect(ctx, r.x, r.y, r.w, r.h, 6);
    ctx.stroke();

    // 左侧类型色条
    var typeColor = p.lineageType === S.LINEAGE.OUT_MARRIED ? COLORS.out
      : p.lineageType === S.LINEAGE.EXTERNAL ? COLORS.external
      : COLORS.clan;
    ctx.save();
    roundRect(ctx, r.x, r.y, r.w, r.h, 6);
    ctx.clip();
    ctx.fillStyle = typeColor;
    ctx.fillRect(r.x, r.y, 4, r.h);
    ctx.restore();

    // 姓名
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.ink;
    ctx.font = '600 12.5px "Microsoft YaHei", "PingFang SC", sans-serif';
    var hasSpouse = node.spouses && node.spouses.length;
    var nameY = hasSpouse ? r.y + r.h / 2 - 7 : r.y + r.h / 2;
    ctx.fillText(clipText(ctx, S.displayName(p), r.w - 16), r.x + r.w / 2, nameY);

    // 配偶附注
    if (hasSpouse) {
      ctx.fillStyle = COLORS.spouse;
      ctx.font = '11px "Microsoft YaHei", "PingFang SC", sans-serif';
      var sp = node.spouses.map(function (s) { return S.displayName(s.person); }).join('、');
      ctx.fillText(clipText(ctx, '配 ' + sp, r.w - 14), r.x + r.w / 2, r.y + r.h - 12);
    }

    // 世次角标
    ctx.fillStyle = COLORS.ink3;
    ctx.font = '9.5px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('G' + (p.generation || ''), r.x + 8, r.y + 9);

    // 过继标记
    if (p.adoptiveFatherId) {
      ctx.textAlign = 'right';
      ctx.fillStyle = COLORS.out;
      ctx.fillText('嗣', r.x + r.w - 7, r.y + 9);
    }

    ctx.restore();
  }

  function clipText(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    var t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ───────── 交互 ───────── */

  function bindInteractions() {
    var c = view.canvas;
    if (!c) return;

    c.addEventListener('wheel', function (e) {
      e.preventDefault();
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.offsetX, e.offsetY);
    }, { passive: false });

    c.addEventListener('mousedown', function (e) {
      view.dragging = true;
      view.moved = false;
    });

    c.addEventListener('click', function (e) {
      if (view.moved) return;
      var node = hitTest(e.offsetX, e.offsetY);
      view.selectedId = node ? node.id : null;
      draw();
    });

    c.addEventListener('dblclick', function (e) {
      var node = hitTest(e.offsetX, e.offsetY);
      if (node) views.members.showDetail(node.id);
    });

    if (!view._bound) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      window.addEventListener('resize', function () {
        if (view.canvas && document.body.contains(view.canvas)) resize();
      });
      view._bound = true;
    }

    ui.$('#treeFit').addEventListener('click', fitView);
    ui.$('#treeZoomIn').addEventListener('click', function () {
      zoomAt(1.2, view.canvas.clientWidth / 2, view.canvas.clientHeight / 2);
    });
    ui.$('#treeZoomOut').addEventListener('click', function () {
      zoomAt(1 / 1.2, view.canvas.clientWidth / 2, view.canvas.clientHeight / 2);
    });
    ui.$('#treeReset').addEventListener('click', function () {
      view.scale = 1;
      view.offsetX = 24;
      view.offsetY = 24;
      draw();
    });
  }

  function onMove(e) {
    if (!view.dragging || !view.canvas) return;
    var mx = e.movementX || 0;
    var my = e.movementY || 0;
    if (!mx && !my) return;
    view.offsetX += mx;
    view.offsetY += my;
    if (Math.abs(mx) + Math.abs(my) > 1) view.moved = true;
    draw();
  }

  function onUp() {
    view.dragging = false;
    if (view.canvas) view.canvas.classList.remove('dragging');
  }

  function zoomAt(factor, sx, sy) {
    var newScale = Math.min(3, Math.max(0.15, view.scale * factor));
    var k = newScale / view.scale;
    view.offsetX = sx - (sx - view.offsetX) * k;
    view.offsetY = sy - (sy - view.offsetY) * k;
    view.scale = newScale;
    draw();
  }

  function hitTest(sx, sy) {
    var wx = (sx - view.offsetX) / view.scale;
    var wy = (sy - view.offsetY) / view.scale;
    for (var i = view.nodes.length - 1; i >= 0; i--) {
      var r = nodeRect(view.nodes[i]);
      if (wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h) return view.nodes[i];
    }
    return null;
  }

  function fitView() {
    if (!view.canvas || !view.nodes.length) return;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    view.nodes.forEach(function (n) {
      var r = nodeRect(n);
      minX = Math.min(minX, r.x); minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.h);
    });
    var cw = view.canvas.clientWidth, ch = view.canvas.clientHeight;
    var pad = 30;
    var sx = (cw - pad * 2) / Math.max(1, maxX - minX);
    var sy = (ch - pad * 2) / Math.max(1, maxY - minY);
    view.scale = Math.min(1.4, Math.max(0.15, Math.min(sx, sy)));
    view.offsetX = (cw - (maxX - minX) * view.scale) / 2 - minX * view.scale;
    view.offsetY = (ch - (maxY - minY) * view.scale) / 2 - minY * view.scale;
    draw();
  }

  views.tree = { render: render };
})(window);
