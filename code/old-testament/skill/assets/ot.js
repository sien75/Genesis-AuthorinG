(function () {
  'use strict';

  // -- Project root directory handle (File System Access API) --
  var rootDirHandle = null;

  function promptForProjectRoot() {
    var banner = document.createElement('div');
    banner.id = 'ot-root-banner';
    banner.innerHTML =
      '<span>Click to select the project root directory for source code viewing</span>' +
      '<button id="ot-pick-root">Open Project Folder</button>';
    document.body.prepend(banner);

    document.getElementById('ot-pick-root').addEventListener('click', function () {
      window.showDirectoryPicker({ mode: 'read' }).then(function (handle) {
        rootDirHandle = handle;
        banner.remove();
      }).catch(function () {});
    });
  }

  async function readFileFromRoot(relativePath) {
    if (!rootDirHandle) return null;
    var parts = relativePath.split('/').filter(Boolean);
    var current = rootDirHandle;
    try {
      for (var i = 0; i < parts.length - 1; i++) {
        current = await current.getDirectoryHandle(parts[i]);
      }
      var fileHandle = await current.getFileHandle(parts[parts.length - 1]);
      var file = await fileHandle.getFile();
      return await file.text();
    } catch (e) {
      return null;
    }
  }

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

  async function showSource(nodeId) {
    if (!panel) return;
    var info = sourceMap[nodeId];
    if (!info) return;

    // Prompt for project root if not yet selected
    if (!rootDirHandle) {
      try {
        rootDirHandle = await window.showDirectoryPicker({ mode: 'read' });
      } catch (e) {
        return;
      }
      var banner = document.getElementById('ot-root-banner');
      if (banner) banner.remove();
    }

    headerEl.querySelector('.file-path').textContent = info.file;
    headerEl.querySelector('.line-range').textContent =
      ':' + info.startLine + '-' + info.endLine;

    // Read file content from local filesystem
    var content = await readFileFromRoot(info.file);
    if (!content) {
      panel.classList.add('visible');
      initMonaco(function () {
        editor.setValue('// Could not read file: ' + info.file);
      });
      return;
    }

    panel.classList.add('visible');

    initMonaco(function () {
      var lang = guessLanguage(info.file);
      var model = editor.getModel();
      monaco.editor.setModelLanguage(model, lang);
      editor.setValue(content);

      // Set line numbers to match the actual file
      editor.updateOptions({ lineNumbers: 'on' });

      // Scroll to and highlight the relevant lines
      var startLine = info.startLine;
      var endLine = info.endLine;

      editor.revealRangeInCenter(new monaco.Range(startLine, 1, endLine, 1));

      editor.deltaDecorations(
        editor.getModel().getAllDecorations()
          .filter(function (d) { return d.options.className === 'ot-highlight-line'; })
          .map(function (d) { return d.id; }),
        [{
          range: new monaco.Range(startLine, 1, endLine, 1),
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

  // -- Bootstrap --
  if (document.querySelectorAll('.mermaid').length > 0) {
    loadMermaid();
    // Show banner to select project root on page load
    if (Object.keys(sourceMap).length > 0) {
      promptForProjectRoot();
    }
  }
})();
