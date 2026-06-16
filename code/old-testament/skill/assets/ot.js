(function () {
  'use strict';

  // -- Load mermaid from CDN and render diagrams --
  function loadMermaid() {
    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
    script.onload = function () {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' });
      mermaid.run().then(function () {
        attachClickHandlers();
      });
    };
    document.head.appendChild(script);
  }

  // -- Source panel setup --
  var sourceMap = window.__sourceMap || {};
  var panel = document.getElementById('source-panel');

  if (panel) {
    var headerEl = document.getElementById('source-header');
    var monacoContainer = document.getElementById('monaco-container');
    var editor = null;
    var monacoReady = false;

    headerEl.innerHTML =
      '<span><span class="file-path"></span> <span class="line-range"></span></span>' +
      '<button id="source-close">&times;</button>';

    document.getElementById('source-close').addEventListener('click', function () {
      panel.classList.remove('visible');
    });
  }

  function initMonaco(callback) {
    if (monacoReady) { callback(); return; }

    window.require = { paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' } };

    var loaderScript = document.createElement('script');
    loaderScript.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/loader.js';
    loaderScript.onload = function () {
      window.require(['vs/editor/editor.main'], function () {
        editor = monaco.editor.create(monacoContainer, {
          value: '',
          language: 'typescript',
          theme: 'vs-dark',
          readOnly: true,
          minimap: { enabled: false },
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          folding: false,
          contextmenu: false,
          hover: { enabled: false },
          renderLineHighlight: 'none',
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          overviewRulerBorder: false,
          scrollbar: { vertical: 'auto', horizontal: 'auto' },
          automaticLayout: true,
          fontSize: 13,
          fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
          padding: { top: 8, bottom: 8 }
        });
        monacoReady = true;
        callback();
      });
    };
    document.head.appendChild(loaderScript);
  }

  function guessLanguage(filePath) {
    var ext = filePath.split('.').pop().toLowerCase();
    var map = {
      ts: 'typescript', tsx: 'typescript',
      js: 'javascript', jsx: 'javascript', mjs: 'javascript',
      py: 'python',
      go: 'go',
      rs: 'rust',
      java: 'java',
      kt: 'kotlin',
      rb: 'ruby',
      cpp: 'cpp', cc: 'cpp', cxx: 'cpp', h: 'cpp', hpp: 'cpp',
      c: 'c',
      cs: 'csharp',
      swift: 'swift',
      json: 'json',
      yaml: 'yaml', yml: 'yaml',
      html: 'html',
      css: 'css',
      scss: 'scss',
      sql: 'sql',
      sh: 'shell', bash: 'shell', zsh: 'shell',
      md: 'markdown',
      xml: 'xml',
      toml: 'ini',
      dockerfile: 'dockerfile'
    };
    return map[ext] || 'plaintext';
  }

  function showSource(nodeId) {
    if (!panel) return;
    var info = sourceMap[nodeId];
    if (!info) return;

    headerEl.querySelector('.file-path').textContent = info.file;
    headerEl.querySelector('.line-range').textContent =
      ':' + info.startLine + '-' + info.endLine;

    if (!info.snippet) {
      panel.classList.add('visible');
      if (editor) editor.setValue('// Source not available');
      return;
    }

    panel.classList.add('visible');

    initMonaco(function () {
      var lang = guessLanguage(info.file);
      var model = editor.getModel();
      monaco.editor.setModelLanguage(model, lang);
      editor.setValue(info.snippet);

      var lineCount = info.snippet.split('\n').length;
      var startOffset = 1;
      var endOffset = lineCount;

      editor.revealLineInCenter(Math.floor((startOffset + endOffset) / 2));

      editor.deltaDecorations(
        editor.getModel().getAllDecorations()
          .filter(function (d) { return d.options.className === 'ot-highlight-line'; })
          .map(function (d) { return d.id; }),
        [{
          range: new monaco.Range(startOffset, 1, endOffset, 1),
          options: {
            isWholeLine: true,
            className: 'ot-highlight-line',
            linesDecorationsClassName: 'ot-highlight-gutter'
          }
        }]
      );
    });
  }

  function attachClickHandlers() {
    var nodes = document.querySelectorAll('.mermaid svg .node');
    nodes.forEach(function (node) {
      var id = node.id;
      var match = id.match(/^flowchart-(.+?)-\d+$/);
      var nodeId = match ? match[1] : id;

      if (sourceMap[nodeId]) {
        node.style.cursor = 'pointer';
        node.addEventListener('click', function () {
          showSource(nodeId);
        });
      }
    });
  }

  // -- Bootstrap: load mermaid, which triggers render, which triggers click handlers --
  if (document.querySelectorAll('.mermaid').length > 0) {
    loadMermaid();
  }
})();
