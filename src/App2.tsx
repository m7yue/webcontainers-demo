import { TextareaHTMLAttributes, useEffect, useRef, useState } from 'react'

import { WebContainer, FileNode } from '@webcontainer/api';
import { files } from './files';
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit';

import './style.css'
import 'xterm/css/xterm.css';

// Call only once
const webcontainerInstance = await WebContainer.boot();
const {
  fs,
  spawn,
  mount,
  teardown,
} = webcontainerInstance
const {
  readdir,
  readFile,
  writeFile,
  mkdir,
  rm
} = fs

const init = async (textareaEl: HTMLTextAreaElement, iframeEl: HTMLIFrameElement, terminalEl: HTMLDivElement) => {
  const writeIndexJS = async (content: string, webcontainerInstance: WebContainer) => {
    await webcontainerInstance.fs.writeFile('/index.js', content);
  }

  textareaEl.value = (files['index.js'] as FileNode).file.contents.toString();
  textareaEl.addEventListener('input', (e: any) => {
    writeIndexJS(e.currentTarget?.value, webcontainerInstance);
  });

  const fitAddon = new FitAddon();

  const terminal = new Terminal({
    convertEol: true,
  });
  terminal.loadAddon(fitAddon)
  terminal.open(terminalEl);

  fitAddon.fit()

  const startShell = async (terminal: Terminal) => {
    const shellProcess = await webcontainerInstance.spawn('jsh', {
      terminal: {
        cols: terminal.cols,
        rows: terminal.rows,
      },
    });
    shellProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          terminal.write(data);
        },
      })
    );

    const input = shellProcess.input.getWriter();
    terminal.onData((data) => {
      input.write(data);
    });

    return shellProcess;
  };
  const shellProcess = startShell(terminal);
  window.addEventListener('resize', async () => {
    fitAddon.fit();
    (await shellProcess).resize({
      cols: terminal.cols,
      rows: terminal.rows,
    });
  });

  // 加载文件系统
  await webcontainerInstance.mount(files);


  webcontainerInstance.on('server-ready', (port, url) => {
    console.log(url)
    iframeEl.src = url;
  });
}


function App() {
  const iframeEl = useRef(null)
  const textareaEl = useRef(null)
  const terminalEl = useRef(null)

  useEffect(() => {
    if (textareaEl.current && iframeEl.current && terminalEl.current) {
      init(textareaEl.current, iframeEl.current, terminalEl.current)
    }
  }, [])

  return (
    <div>
      <div className="container">
        <div className="editor">
          <textarea ref={textareaEl}>I am a textarea</textarea>
        </div>
        <div className="preview">
          <iframe ref={iframeEl} src="loading.html"></iframe>
        </div>
      </div>
      <div ref={terminalEl} className="terminal"></div>
    </div>
  )
}

export default App
