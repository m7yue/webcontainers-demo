import { TextareaHTMLAttributes, useEffect, useRef, useState } from 'react'

import { WebContainer, FileNode } from '@webcontainer/api';
import { files } from './files';
import { Terminal } from 'xterm'

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
  const startDevServer = async (webcontainerInstance: WebContainer, terminal: Terminal) => {
    const installProcess = await webcontainerInstance.spawn('npm', ['install']);
    const installExitCode = await installProcess.exit;
  
    if (installExitCode !== 0) {
      throw new Error('Unable to run npm install');
    }
  
    // `npm run dev`
    const serverProcess = await webcontainerInstance.spawn('npm', ['run', 'start']);

    serverProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          terminal.write(data);
        },
      })
    );

    webcontainerInstance.on('server-ready', (port, url) => {
      console.log(url)
      iframeEl.src = url;
    });
  }

  const installDependencies = async (webcontainerInstance: WebContainer, terminal: Terminal) => {
    // Install dependencies
    const installProcess = await webcontainerInstance.spawn('npm', ['install']);
    installProcess.output.pipeTo(new WritableStream({
      write(data) {
        terminal.write(data)
      }
    }))
    // Wait for install command to exit
    return installProcess.exit;
  }

  const writeIndexJS = async (content: string, webcontainerInstance: WebContainer) => {
    await webcontainerInstance.fs.writeFile('/index.js', content);
  }

  const terminal = new Terminal({
    convertEol: true,
  });
  terminal.open(terminalEl);

  // 加载文件系统
  await webcontainerInstance.mount(files);
  
  const exitCode = await installDependencies(webcontainerInstance, terminal);
  if (exitCode !== 0) {
    throw new Error('Installation failed');
  };

  startDevServer(webcontainerInstance, terminal)

  textareaEl.value = (files['index.js'] as FileNode).file.contents.toString();
  textareaEl.addEventListener('input', (e: any) => {
    writeIndexJS(e.currentTarget?.value, webcontainerInstance);
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
