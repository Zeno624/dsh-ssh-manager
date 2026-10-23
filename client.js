// Browser half of the SSH manager: a global host-resource page in the left sidebar,
// a per-session host authorization picker beside the composer, and a per-host remote
// file browser in the right sidebar. Host data is reached through the plugin's own
// `ssh-manager` command.
window.__ModuleLoader__.load({
  id: '@local/dsh-ssh-manager',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const FILES_ID = '@local/dsh-ssh-manager/files'
    const PANEL_ID = 'ssh-resources'
    const NS = 'sshManager'
    const CMD = '/ssh-manager '

    const zh = {
      panel: '远程主机',
      title: '远程主机',
      subtitle: '把远程机器当作会话可用的资源。在这里维护连接，在会话里按需授权。',
      filesTitle: '远程文件',
      filesDesc: '按主机浏览远程文件，右键把路径插入会话',
      add: '添加主机',
      edit: '编辑',
      remove: '删除',
      save: '保存',
      cancel: '取消',
      saving: '保存中…',
      name: '名称',
      host: '地址',
      user: '用户名',
      port: '端口',
      root: '初始目录',
      group: '分组',
      note: '备注',
      notePlaceholder: '例如：编译机 / 部署机',
      password: '密码',
      passwordSet: '已保存密码，留空则不修改',
      passwordUnset: '可留空，改用 SSH 密钥',
      clearPassword: '清除已保存的密码',
      passwordStored: '已配置密码',
      online: '在线',
      offline: '离线',
      unknown: '未知',
      empty: '还没有远程主机',
      emptyHint: '添加第一台主机后，就可以在会话里授权并浏览它的文件。',
      loading: '正在读取…',
      noSession: '打开任意会话后即可管理远程主机。',
      failed: '操作失败：{message}',
      picker: 'SSH 主机',
      pickerBadge: '{n}',
      pickerTitle: '授权给本会话',
      pickerHint: '勾选后 agent 才能访问这些主机',
      pickerEmpty: '还没有主机，先去左侧“远程主机”添加。',
      manage: '管理主机',
      openFiles: '文件',
      openFilesTitle: '浏览该主机的文件',
      chooserTitle: '选择要浏览的主机',
      chooserHint: '只显示已授权给当前会话的主机',
      chooserEmpty: '本会话还没有授权任何主机',
      chooserAction: '去授权',
      refresh: '刷新',
      up: '上一级',
      download: '下载到工作区',
      upload: '上传文件到这里',
      mkdir: '新建文件夹',
      rename: '重命名',
      delete: '删除',
      insert: '插入路径到会话',
      copyPath: '复制路径',
      copyDone: '已复制路径',
      localPath: '工作区文件（相对路径）',
      localPathHint: '例如 src/app.py，文件必须在当前会话工作区内',
      newName: '名称',
      deleteTitle: '删除主机',
      deleteBody: '确定删除「{name}」？保存的密码也会一并清除。',
      deleteFileTitle: '删除远程路径',
      deleteFileBody: '确定删除「{path}」？此操作不可撤销。',
      inserted: '已插入 {ref}',
      insertFailed: '插入失败：请先点一下输入框再试',
      downloaded: '已下载到 {path}',
      uploaded: '已上传到 {path}',
      emptyDir: '这个目录是空的',
      binary: '二进制文件，不展示内容',
      truncated: '已截断',
      close: '关闭',
      deletion: '删除',
      confirm: '确定',
      file: '文件',
      dir: '目录',
      actionFailed: '操作失败：{message}',
      goAuthorize: '去会话授权',
    }

    const en = {
      panel: 'Remote hosts',
      title: 'Remote hosts',
      subtitle: 'Treat remote machines as session resources. Maintain connections here and authorize them per session.',
      filesTitle: 'Remote files',
      filesDesc: 'Browse remote files per host; right-click inserts a path into the conversation',
      add: 'Add host',
      edit: 'Edit',
      remove: 'Delete',
      save: 'Save',
      cancel: 'Cancel',
      saving: 'Saving…',
      name: 'Name',
      host: 'Host',
      user: 'User',
      port: 'Port',
      root: 'Start directory',
      group: 'Group',
      note: 'Note',
      notePlaceholder: 'e.g. build machine / deploy target',
      password: 'Password',
      passwordSet: 'Password saved; leave blank to keep it',
      passwordUnset: 'Optional; leave blank to use SSH keys',
      clearPassword: 'Remove saved password',
      passwordStored: 'password set',
      online: 'online',
      offline: 'offline',
      unknown: 'unknown',
      empty: 'No remote hosts yet',
      emptyHint: 'Add one host, then authorize it in a session and browse its files.',
      loading: 'Loading…',
      noSession: 'Open any session before managing remote hosts.',
      failed: 'Failed: {message}',
      picker: 'SSH hosts',
      pickerBadge: '{n}',
      pickerTitle: 'Authorized for this session',
      pickerHint: 'The agent can only reach ticked hosts',
      pickerEmpty: 'No hosts yet. Add them under “Remote hosts” on the left.',
      manage: 'Manage hosts',
      openFiles: 'Files',
      openFilesTitle: 'Browse files on this host',
      chooserTitle: 'Choose a host to browse',
      chooserHint: 'Only hosts authorized for this session are listed',
      chooserEmpty: 'No host is authorized for this session yet',
      chooserAction: 'Authorize',
      refresh: 'Refresh',
      up: 'Parent directory',
      download: 'Download to workspace',
      upload: 'Upload a file here',
      mkdir: 'New folder',
      rename: 'Rename',
      delete: 'Delete',
      insert: 'Insert path into conversation',
      copyPath: 'Copy path',
      copyDone: 'Path copied',
      localPath: 'Workspace file (relative path)',
      localPathHint: 'e.g. src/app.py; it must live inside the session workspace',
      newName: 'Name',
      deleteTitle: 'Delete host',
      deleteBody: 'Delete “{name}”? A saved password is removed too.',
      deleteFileTitle: 'Delete remote path',
      deleteFileBody: 'Delete “{path}”? This cannot be undone.',
      inserted: 'Inserted {ref}',
      insertFailed: 'Insertion failed: click the composer first and retry',
      downloaded: 'Downloaded to {path}',
      uploaded: 'Uploaded to {path}',
      emptyDir: 'This directory is empty',
      binary: 'Binary file; content is not shown',
      truncated: 'truncated',
      close: 'Close',
      deletion: 'Delete',
      confirm: 'Confirm',
      file: 'File',
      dir: 'Directory',
      actionFailed: 'Failed: {message}',
      goAuthorize: 'Authorize a host',
    }

    const CSS = `
.sshm-page{height:100%;overflow-y:auto;box-sizing:border-box;color:var(--dsw-alias-label-primary);font-size:13px;background:var(--dsw-alias-bg-base)}
.sshm-shell{max-width:820px;margin:0 auto;padding:28px 26px 60px}
.sshm-page-head{display:flex;align-items:flex-start;gap:14px;margin-bottom:18px}
.sshm-page-title{font-size:18px;font-weight:650;line-height:26px;margin:0}
.sshm-page-sub{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;margin-top:3px;max-width:520px}
.sshm-head-actions{margin-left:auto;flex:none;display:flex;gap:8px}
.sshm-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:28px;padding:0 11px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:1;cursor:pointer;transition:background .12s,border-color .12s,color .12s,opacity .12s;white-space:nowrap}
.sshm-btn:hover{background:var(--dsw-alias-bg-layer-2)}
.sshm-btn:active{opacity:.82}
.sshm-btn:disabled{opacity:.45;cursor:default}
.sshm-btn-primary{background:var(--dsw-alias-brand-primary);border-color:transparent;color:#fff}
.sshm-btn-primary:hover{background:var(--dsw-alias-brand-primary);filter:brightness(1.08)}
.sshm-btn-ghost{border-color:transparent;background:transparent;color:var(--dsw-alias-label-secondary)}
.sshm-btn-ghost:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.sshm-btn-danger{color:var(--dsw-alias-state-error-primary);border-color:transparent;background:transparent}
.sshm-btn-danger:hover{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent);color:var(--dsw-alias-state-error-primary)}
.sshm-btn-icon{width:28px;height:28px;padding:0;flex:none}
.sshm-list{border:0.5px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
.sshm-row{display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:0.5px solid var(--dsw-alias-border-l1);transition:background .12s}
.sshm-row:last-child{border-bottom:none}
.sshm-row:hover{background:var(--dsw-alias-bg-layer-2)}
.sshm-glyph{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex:none;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}
.sshm-row-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}
.sshm-row-title{display:flex;align-items:center;gap:7px;min-width:0}
.sshm-name{font-weight:600;font-size:13px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sshm-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sshm-note{font-size:11.5px;color:var(--dsw-alias-label-secondary);line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sshm-row-actions{display:flex;align-items:center;gap:4px;opacity:0;transition:opacity .12s;flex:none}
.sshm-row:hover .sshm-row-actions,.sshm-row:focus-within .sshm-row-actions{opacity:1}
.sshm-pill{display:inline-flex;align-items:center;gap:5px;height:20px;padding:0 7px;border-radius:999px;font-size:10.5px;line-height:1;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);flex:none}
.sshm-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-idle-primary);flex:none}
.sshm-pill-on{color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 14%,transparent)}
.sshm-pill-on .sshm-dot{background:var(--dsw-alias-state-success-primary)}
.sshm-pill-off{color:var(--dsw-alias-label-secondary)}
.sshm-key{display:inline-flex;align-items:center;color:var(--dsw-alias-state-warn-primary)}
.sshm-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:44px 20px;border:1px dashed var(--dsw-alias-border-l2);border-radius:12px;color:var(--dsw-alias-label-secondary);text-align:center}
.sshm-empty-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-layer-2)}
.sshm-empty-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}
.sshm-empty-text{font-size:12px;line-height:18px;max-width:320px}
.sshm-alert{display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border-radius:8px;font-size:12px;line-height:17px;margin-bottom:12px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent);color:var(--dsw-alias-state-error-primary);white-space:pre-wrap;word-break:break-word}
.sshm-backdrop{position:fixed;inset:0;z-index:2100;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.34);animation:sshm-fade .12s ease-out}
.sshm-modal{width:min(560px,100%);max-height:86vh;overflow:auto;border:0.5px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-overlay);box-shadow:0 24px 64px rgba(0,0,0,.28);animation:sshm-pop .14s ease-out}
.sshm-modal-head{display:flex;align-items:center;gap:10px;padding:16px 18px 12px}
.sshm-modal-title{font-size:15px;font-weight:650;flex:1;margin:0}
.sshm-modal-body{padding:0 18px 4px;display:grid;grid-template-columns:1fr 1fr;gap:12px}
.sshm-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:16px 18px}
.sshm-field{display:flex;flex-direction:column;gap:5px;min-width:0}
.sshm-field-full{grid-column:1/-1}
.sshm-label{font-size:11px;color:var(--dsw-alias-label-secondary);font-weight:500}
.sshm-input{box-sizing:border-box;width:100%;height:30px;padding:0 9px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;outline:none;transition:border-color .12s,box-shadow .12s}
.sshm-input:focus{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 18%,transparent)}
.sshm-hint{font-size:11px;line-height:15px;color:var(--dsw-alias-label-secondary)}
.sshm-check{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer;user-select:none}
.sshm-check input{accent-color:var(--dsw-alias-brand-primary);margin:0}
.sshm-picker{position:relative;display:inline-flex}
.sshm-chip{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 9px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:999px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;transition:background .12s,border-color .12s}
.sshm-chip:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.sshm-chip-on{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 45%,var(--dsw-alias-border-l2));color:var(--dsw-alias-label-primary)}
.sshm-chip-badge{min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:var(--dsw-alias-brand-primary);color:#fff;font-size:10px;line-height:16px;text-align:center;font-weight:600}
.sshm-popover{position:absolute;left:0;bottom:32px;z-index:1200;width:320px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-overlay);box-shadow:0 18px 48px rgba(0,0,0,.24);overflow:hidden;animation:sshm-pop .13s ease-out}
.sshm-pop-head{padding:12px 12px 8px}
.sshm-pop-title{font-size:12.5px;font-weight:600}
.sshm-pop-hint{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:2px}
.sshm-pop-list{max-height:300px;overflow-y:auto;padding:2px 6px 6px}
.sshm-host-row{display:flex;align-items:center;gap:9px;padding:7px 8px;border-radius:8px;cursor:pointer;transition:background .12s}
.sshm-host-row:hover{background:var(--dsw-alias-bg-layer-2)}
.sshm-host-main{min-width:0;flex:1}
.sshm-host-name{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:550;line-height:17px}
.sshm-host-target{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sshm-switch{position:relative;width:30px;height:18px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l2);cursor:pointer;flex:none;transition:background .15s,border-color .15s}
.sshm-switch::after{content:'';position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:var(--dsw-alias-label-secondary);transition:transform .15s,background .15s}
.sshm-switch-on{background:var(--dsw-alias-brand-primary);border-color:transparent}
.sshm-switch-on::after{transform:translateX(12px);background:#fff}
.sshm-pop-foot{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-top:0.5px solid var(--dsw-alias-border-l1);font-size:11px;color:var(--dsw-alias-label-secondary)}
.sshm-link{color:var(--dsw-alias-brand-primary);cursor:pointer;font-size:11px;background:none;border:none;padding:0;font-family:inherit}
.sshm-link:hover{text-decoration:underline}
.sshm-files{height:100%;display:flex;flex-direction:column;overflow:hidden;color:var(--dsw-alias-label-primary);font-size:13px;background:var(--dsw-alias-bg-base)}
.sshm-toolbar{display:flex;align-items:center;gap:7px;padding:10px 12px;border-bottom:0.5px solid var(--dsw-alias-border-l1);flex-wrap:wrap;flex:none}
.sshm-toolbar-host{display:flex;align-items:center;gap:7px;font-weight:600;font-size:12.5px;min-width:0}
.sshm-crumbs{display:flex;align-items:center;flex-wrap:wrap;gap:2px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;color:var(--dsw-alias-label-secondary);min-width:0;flex:1}
.sshm-crumb{padding:2px 5px;border-radius:5px;cursor:pointer;white-space:nowrap;transition:background .1s,color .1s}
.sshm-crumb:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.sshm-sep{opacity:.45}
.sshm-file-list{flex:1;overflow-y:auto;padding:6px}
.sshm-file-row{display:flex;align-items:center;gap:9px;padding:7px 9px;border-radius:8px;cursor:pointer;transition:background .1s}
.sshm-file-row:hover{background:var(--dsw-alias-bg-layer-2)}
.sshm-file-icon{width:18px;height:18px;display:flex;align-items:center;justify-content:center;flex:none;color:var(--dsw-alias-label-secondary)}
.sshm-file-icon-dir{color:var(--dsw-alias-state-warn-primary)}
.sshm-file-name{flex:1;min-width:0;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sshm-file-meta{font-size:10.5px;color:var(--dsw-alias-label-secondary);flex:none;font-variant-numeric:tabular-nums}
.sshm-actions-row{display:flex;gap:6px;padding:2px 8px 8px;flex:none}
.sshm-status{padding:22px 14px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.sshm-status-error{color:var(--dsw-alias-state-error-primary)}
.sshm-skeleton{display:flex;align-items:center;gap:9px;padding:8px 9px}
.sshm-sk{height:11px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);animation:sshm-pulse 1.1s ease-in-out infinite}
.sshm-preview{border-top:0.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);max-height:40%;display:flex;flex-direction:column;flex:none}
.sshm-preview-head{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:0.5px solid var(--dsw-alias-border-l1)}
.sshm-preview-name{flex:1;min-width:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sshm-pre{margin:0;padding:10px 12px;overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-all}
.sshm-menu-overlay{position:fixed;inset:0;z-index:2000}
.sshm-menu{position:fixed;z-index:2001;min-width:196px;padding:5px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-overlay);box-shadow:0 18px 48px rgba(0,0,0,.26);animation:sshm-pop .12s ease-out}
.sshm-menu-item{display:flex;align-items:center;gap:9px;padding:7px 9px;border-radius:7px;font-size:12px;cursor:pointer;transition:background .1s,color .1s}
.sshm-menu-item:hover{background:var(--dsw-alias-bg-layer-2)}
.sshm-menu-item svg{opacity:.75;flex:none}
.sshm-menu-danger{color:var(--dsw-alias-state-error-primary)}
.sshm-menu-danger:hover{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent)}
.sshm-menu-sep{height:0.5px;background:var(--dsw-alias-border-l1);margin:5px 4px}
.sshm-toast{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:1500;max-width:calc(100% - 24px);padding:7px 12px;border-radius:999px;background:var(--dsw-alias-bg-overlay);border:0.5px solid var(--dsw-alias-border-l2);box-shadow:0 10px 30px rgba(0,0,0,.2);font-size:11.5px;color:var(--dsw-alias-label-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;animation:sshm-pop .14s ease-out}
.sshm-toast-error{color:var(--dsw-alias-state-error-primary)}
@keyframes sshm-fade{from{opacity:0}to{opacity:1}}
@keyframes sshm-pop{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
@keyframes sshm-pulse{0%,100%{opacity:.55}50%{opacity:.9}}
.sshm-abs{position:relative}
`

    // --- inline icons -------------------------------------------------------
    function svg(children, size) {
      return h('svg', {
        width: size || 16,
        height: size || 16,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.7,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
      }, ...children)
    }
    const Icons = {
      plus: (s) => svg([h('path', { key: 'a', d: 'M12 5v14' }), h('path', { key: 'b', d: 'M5 12h14' })], s),
      pencil: (s) => svg([h('path', { key: 'a', d: 'M4 20h4l10-10-4-4L4 16v4z' }), h('path', { key: 'b', d: 'M13 7l4 4' })], s),
      trash: (s) => svg([h('path', { key: 'a', d: 'M4 7h16' }), h('path', { key: 'b', d: 'M9 7V5h6v2' }), h('path', { key: 'c', d: 'M6 7l1 13h10l1-13' }), h('path', { key: 'd', d: 'M10 11v5M14 11v5' })], s),
      refresh: (s) => svg([h('path', { key: 'a', d: 'M20 11a8 8 0 1 0-2.3 5.7' }), h('path', { key: 'b', d: 'M20 4v7h-7' })], s),
      folder: (s) => svg([h('path', { key: 'a', d: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z' })], s),
      file: (s) => svg([h('path', { key: 'a', d: 'M6 3h8l4 4v14H6z' }), h('path', { key: 'b', d: 'M14 3v4h4' })], s),
      key: (s) => svg([h('circle', { key: 'a', cx: 8, cy: 15, r: 4 }), h('path', { key: 'b', d: 'M11 12l9-9M17 6l3 3' })], s),
      x: (s) => svg([h('path', { key: 'a', d: 'M6 6l12 12M18 6L6 18' })], s),
      check: (s) => svg([h('path', { key: 'a', d: 'M4 12l5 5L20 6' })], s),
      up: (s) => svg([h('path', { key: 'a', d: 'M12 19V5' }), h('path', { key: 'b', d: 'M5 12l7-7 7 7' })], s),
      more: (s) => svg([h('circle', { key: 'a', cx: 5, cy: 12, r: 1 }), h('circle', { key: 'b', cx: 12, cy: 12, r: 1 }), h('circle', { key: 'c', cx: 19, cy: 12, r: 1 })], s),
      copy: (s) => svg([h('rect', { key: 'a', x: 9, y: 9, width: 11, height: 11, rx: 2 }), h('path', { key: 'b', d: 'M5 15V5a2 2 0 0 1 2-2h8' })], s),
      insert: (s) => svg([h('path', { key: 'a', d: 'M4 12h10' }), h('path', { key: 'b', d: 'M10 6l6 6-6 6' })], s),
      download: (s) => svg([h('path', { key: 'a', d: 'M12 4v11' }), h('path', { key: 'b', d: 'M7 11l5 5 5-5' }), h('path', { key: 'c', d: 'M5 20h14' })], s),
      upload: (s) => svg([h('path', { key: 'a', d: 'M12 20V9' }), h('path', { key: 'b', d: 'M7 13l5-5 5 5' }), h('path', { key: 'c', d: 'M5 4h14' })], s),
      plusFolder: (s) => svg([h('path', { key: 'a', d: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z' }), h('path', { key: 'b', d: 'M12 11v6M9 14h6' })], s),
      server: (s) => svg([h('rect', { key: 'a', x: 3, y: 4, width: 18, height: 7, rx: 2 }), h('rect', { key: 'b', x: 3, y: 13, width: 18, height: 7, rx: 2 }), h('path', { key: 'c', d: 'M7 7.5h.01M7 16.5h.01' })], s),
      chevron: (s) => svg([h('path', { key: 'a', d: 'M9 6l6 6-6 6' })], s),
    }

    // --- helpers ------------------------------------------------------------
    function interp(text, params) {
      if (!params) return String(text)
      return String(text).replace(/\{(\w+)\}/g, (match, key) => (Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match))
    }

    function formatSize(bytes) {
      const n = Number(bytes)
      if (!Number.isFinite(n) || n < 0) return ''
      if (n < 1024) return n + ' B'
      if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' K'
      if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' M'
      return (n / 1024 / 1024 / 1024).toFixed(1) + ' G'
    }

    function formatTime(ms) {
      const value = Number(ms)
      if (!Number.isFinite(value) || value <= 0) return ''
      const date = new Date(value)
      const pad = (part) => String(part).padStart(2, '0')
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    }

    function joinRemote(dir, name) {
      if (!dir || dir === '/') return '/' + name
      return dir.replace(/\/+$/, '') + '/' + name
    }

    function passwordRefFor(hostId) {
      return 'DSH_SSH_PASSWORD_' + String(hostId).toUpperCase().replace(/[^A-Z0-9_]/g, '_')
    }

    function commandRemote(ctx) {
      const remote = ctx.get ? ctx.get('remote') : undefined
      return remote && remote.commands ? remote.commands : undefined
    }

    function credentialRemote(ctx) {
      const remote = ctx.get ? ctx.get('remote') : undefined
      return remote && remote.credentials ? remote.credentials : undefined
    }

    async function callCredentials(ctx, method, args) {
      const credentials = credentialRemote(ctx)
      if (credentials === undefined) throw new Error('credentials Remote is unavailable')
      const fn = credentials[method]
      if (typeof fn !== 'function') throw new Error('credentials Remote is missing ' + method)
      const result = await fn(...args)
      if (result && typeof result === 'object' && Object.prototype.hasOwnProperty.call(result, 'ok')) {
        if (!result.ok) throw new Error(result.error && result.error.message ? result.error.message : 'credential operation failed')
        return result.value
      }
      return result
    }

    async function callHost(ctx, sessionId, payload, signal) {
      const commands = commandRemote(ctx)
      if (commands === undefined || typeof commands.execute !== 'function') throw new Error('commands Remote is unavailable')
      if (!sessionId) throw new Error('需要一个会话来执行命令')
      const result = await commands.execute(sessionId, CMD + JSON.stringify(payload), [], signal)
      let execution = result
      if (result && typeof result === 'object' && Object.prototype.hasOwnProperty.call(result, 'ok')) {
        if (!result.ok) throw new Error(result.error && result.error.message ? result.error.message : 'command failed')
        execution = result.value
      }
      if (!execution) throw new Error('ssh-manager command did not run')
      const outcome = execution.result
      if (outcome && outcome.kind === 'error') throw new Error(outcome.text || 'ssh-manager failed')
      const text = outcome && outcome.text
      return text ? JSON.parse(text) : null
    }

    function pickSessionId(useSessions) {
      try {
        const snapshot = useSessions((value) => value)
        if (!snapshot) return undefined
        const byId = snapshot.byId || {}
        const keys = Object.keys(byId)
        const selected = snapshot.selectedId || snapshot.selectedSessionId || snapshot.currentId
        if (typeof selected === 'string' && byId[selected]) return selected
        return keys[0]
      } catch (error) {
        return undefined
      }
    }

    function useHosts(ctx, sessionId) {
      const [state, setState] = React.useState(null)
      const [statuses, setStatuses] = React.useState({})
      const [error, setError] = React.useState(null)
      const [loading, setLoading] = React.useState(true)
      const [tick, setTick] = React.useState(0)
      React.useEffect(() => {
        if (!sessionId) {
          setLoading(false)
          return undefined
        }
        const controller = new AbortController()
        setLoading(true)
        ;(async () => {
          try {
            const next = await callHost(ctx, sessionId, { op: 'state' }, controller.signal)
            if (controller.signal.aborted) return
            setState(next)
            setError(null)
            try {
              const status = await callHost(ctx, sessionId, { op: 'status', ids: (next && next.hosts ? next.hosts : []).map((host) => host.id) }, controller.signal)
              if (!controller.signal.aborted && status) setStatuses(status.statuses || {})
            } catch (statusError) {}
          } catch (failure) {
            if (!controller.signal.aborted) setError(failure && failure.message ? failure.message : String(failure))
          } finally {
            if (!controller.signal.aborted) setLoading(false)
          }
        })()
        return () => controller.abort()
      }, [ctx, sessionId, tick])
      return { state, statuses, error, loading, reload: () => setTick((value) => value + 1) }
    }

    function existingFileTab(ctx, sessionId, hostId) {
      try {
        const tabs = ctx.sidebarRight.openTabs.getSnapshot().filter((tab) => tab.kind === 'ssh-files' && tab.sessionId === sessionId)
        for (const tab of tabs) {
          const params = ctx.sidebarRight.tabDomain.occurrence(sessionId, { id: tab.id }).navigation.getSnapshot().params
          if (params && params.hostId === hostId) return tab.id
        }
      } catch (error) {}
      return undefined
    }

    function openHostFiles(ctx, sessionId, hostId) {
      const existing = existingFileTab(ctx, sessionId, hostId)
      if (existing !== undefined) {
        ctx.sidebarRight.focus(existing)
        return
      }
      ctx.sidebarRight.openTab('ssh-files', { params: { hostId } })
    }

    function insertReference(props, host, path, notify) {
      const ref = '@' + host.name + ':' + path + ' '
      try {
        const actions = props.inputActions
        if (!actions || typeof actions.insertText !== 'function') throw new Error('composer not available')
        const span = typeof actions.captureInsertion === 'function' ? actions.captureInsertion() : undefined
        const result = actions.insertText(ref, span)
        const settle = (value) => {
          if (value && value.ok === false) notify({ ok: false, text: interp(props.t('insertFailed')) })
          else notify({ ok: true, text: interp(props.t('inserted'), { ref: ref.trim() }) })
        }
        if (result && typeof result.then === 'function') result.then(settle).catch(() => notify({ ok: false, text: props.t('insertFailed') }))
        else settle(result)
      } catch (error) {
        notify({ ok: false, text: props.t('insertFailed') })
      }
    }

    // --- small components ---------------------------------------------------
    function Button({ variant, icon, children, title, onClick, disabled, className }) {
      const cls = ['sshm-btn']
      if (variant === 'primary') cls.push('sshm-btn-primary')
      else if (variant === 'ghost') cls.push('sshm-btn-ghost')
      else if (variant === 'danger') cls.push('sshm-btn-danger')
      if (!children) cls.push('sshm-btn-icon')
      if (className) cls.push(className)
      return h('button', { type: 'button', className: cls.join(' '), title, disabled, onClick }, icon || null, children || null)
    }

    function StatusPill({ online, t }) {
      if (online === undefined) {
        return h('span', { className: 'sshm-pill sshm-pill-off' }, h('span', { className: 'sshm-dot' }), t('unknown'))
      }
      return h('span', { className: 'sshm-pill ' + (online ? 'sshm-pill-on' : 'sshm-pill-off') },
        h('span', { className: 'sshm-dot' }),
        online ? t('online') : t('offline'))
    }

    function Toast({ toast, onDone }) {
      React.useEffect(() => {
        if (!toast) return undefined
        const timer = setTimeout(onDone, 2600)
        return () => clearTimeout(timer)
      }, [toast, onDone])
      if (!toast) return null
      return h('div', { className: 'sshm-toast' + (toast.ok === false ? ' sshm-toast-error' : '') }, toast.text)
    }

    function Modal({ title, children, footer, onClose }) {
      React.useEffect(() => {
        const onKey = (event) => {
          if (event.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
      }, [onClose])
      return h('div', { className: 'sshm-backdrop', onPointerDown: (event) => { if (event.target === event.currentTarget) onClose() } },
        h('div', { className: 'sshm-modal', role: 'dialog', 'aria-modal': 'true' },
          h('div', { className: 'sshm-modal-head' },
            h('h2', { className: 'sshm-modal-title' }, title),
            h(Button, { variant: 'ghost', icon: Icons.x(15), title: 'Close', onClick: onClose })),
          children,
          h('div', { className: 'sshm-modal-foot' }, footer || null)))
    }

    function Field({ label, value, onChange, type, hint, placeholder, full, autoFocus }) {
      return h('label', { className: 'sshm-field' + (full ? ' sshm-field-full' : '') },
        h('span', { className: 'sshm-label' }, label),
        h('input', { className: 'sshm-input', type: type || 'text', value: value === undefined ? '' : value, placeholder, autoFocus, onChange: (event) => onChange(event.target.value) }),
        hint ? h('span', { className: 'sshm-hint' }, hint) : null)
    }

    // --- host form ----------------------------------------------------------
    function HostEditor({ t, host, busy, error, onCancel, onSave }) {
      const editing = host !== undefined && host !== null
      const [draft, setDraft] = React.useState({
        id: editing ? host.id : undefined,
        name: editing ? host.name : '',
        host: editing ? host.host : '',
        user: editing ? host.user || 'root' : 'root',
        port: editing ? host.port : 22,
        root: editing ? host.root || '/' : '/',
        group: editing ? host.group || '' : '',
        note: editing ? host.note || '' : '',
        password: '',
        clearPassword: false,
      })
      const set = (key) => (value) => setDraft((current) => ({ ...current, [key]: value }))
      const hasPassword = !!(editing && host.hasPassword)
      return h(Modal, {
        title: editing ? t('edit') + ' · ' + host.name : t('add'),
        onClose: onCancel,
        footer: [
          h(Button, { key: 'cancel', variant: 'ghost', onClick: onCancel }, t('cancel')),
          h(Button, { key: 'save', variant: 'primary', disabled: busy, onClick: () => onSave(draft) }, busy ? t('saving') : t('save')),
        ],
      },
        h('div', { className: 'sshm-modal-body' },
          error ? h('div', { className: 'sshm-alert sshm-field-full' }, error) : null,
          h(Field, { label: t('name'), value: draft.name, onChange: set('name'), placeholder: 'compile' }),
          h(Field, { label: t('host'), value: draft.host, onChange: set('host'), placeholder: '192.0.2.10' }),
          h(Field, { label: t('user'), value: draft.user, onChange: set('user') }),
          h(Field, { label: t('port'), value: draft.port, onChange: set('port'), type: 'number' }),
          h(Field, { label: t('root'), value: draft.root, onChange: set('root'), hint: '/ 或 /var/www' }),
          h(Field, { label: t('group'), value: draft.group, onChange: set('group') }),
          h(Field, { label: t('note'), value: draft.note, onChange: set('note'), placeholder: t('notePlaceholder'), full: true }),
          h(Field, { label: t('password'), value: draft.password, onChange: set('password'), type: 'password', hint: hasPassword ? t('passwordSet') : t('passwordUnset'), full: true }),
          hasPassword
            ? h('label', { className: 'sshm-check sshm-field-full' },
              h('input', { type: 'checkbox', checked: draft.clearPassword === true, onChange: (event) => setDraft((current) => ({ ...current, clearPassword: event.target.checked, password: event.target.checked ? '' : current.password })) }),
              t('clearPassword'))
            : null))
    }

    // --- management page ----------------------------------------------------
    function ManagementPage(props) {
      const { ctx, t } = props
      const sessionId = pickSessionId(props.useSessions)
      const { state, statuses, error, loading, reload } = useHosts(ctx, sessionId)
      const [editor, setEditor] = React.useState(null)
      const [confirm, setConfirm] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const [editorError, setEditorError] = React.useState(null)
      const [toast, setToast] = React.useState(null)

      const hosts = state && Array.isArray(state.hosts) ? state.hosts : []

      async function saveHost(draft) {
        const id = draft.id || ('h-' + Date.now().toString(36))
        const record = { id, name: draft.name, host: draft.host, user: draft.user, port: draft.port, root: draft.root, group: draft.group, note: draft.note }
        setBusy(true)
        setEditorError(null)
        try {
          if (draft.clearPassword === true) await callCredentials(ctx, 'unset', [passwordRefFor(id)])
          else if (typeof draft.password === 'string' && draft.password !== '') await callCredentials(ctx, 'set', [passwordRefFor(id), draft.password])
          await callHost(ctx, sessionId, { op: 'host.upsert', host: record }, new AbortController().signal)
          setEditor(null)
          reload()
          setToast({ ok: true, text: t('save') + ' ✓' })
        } catch (failure) {
          setEditorError(interp(t('failed'), { message: failure && failure.message ? failure.message : String(failure) }))
        } finally {
          setBusy(false)
        }
      }

      async function deleteHost(host) {
        setBusy(true)
        try {
          await callHost(ctx, sessionId, { op: 'host.remove', id: host.id }, new AbortController().signal)
          setConfirm(null)
          reload()
        } catch (failure) {
          setConfirm(null)
          setToast({ ok: false, text: interp(t('failed'), { message: failure && failure.message ? failure.message : String(failure) }) })
        } finally {
          setBusy(false)
        }
      }

      async function testHost(host) {
        try {
          const status = await callHost(ctx, sessionId, { op: 'status', ids: [host.id] }, new AbortController().signal)
          setToast({ ok: true, text: (status && status.statuses && status.statuses[host.id]) ? t('online') : t('offline') })
        } catch (failure) {
          setToast({ ok: false, text: interp(t('failed'), { message: failure && failure.message ? failure.message : String(failure) }) })
        }
      }

      const header = h('div', { className: 'sshm-page-head' },
        h('div', null,
          h('h1', { className: 'sshm-page-title' }, t('title')),
          h('div', { className: 'sshm-page-sub' }, t('subtitle'))),
        h('div', { className: 'sshm-head-actions' },
          h(Button, { variant: 'primary', icon: Icons.plus(15), disabled: !sessionId, onClick: () => { setEditorError(null); setEditor({ host: null }) } }, t('add'))))

      const skeletons = h('div', { className: 'sshm-list' }, [0, 1, 2].map((index) => h('div', { className: 'sshm-skeleton', key: index },
        h('div', { className: 'sshm-sk', style: { width: '34px', height: '34px', borderRadius: '9px' } }),
        h('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' } },
          h('div', { className: 'sshm-sk', style: { width: '160px' } }),
          h('div', { className: 'sshm-sk', style: { width: '120px', opacity: 0.7 } })))))

      const emptyState = h('div', { className: 'sshm-empty' },
        h('div', { className: 'sshm-empty-icon' }, Icons.server(20)),
        h('div', { className: 'sshm-empty-title' }, t('empty')),
        h('div', { className: 'sshm-empty-text' }, t('emptyHint')),
        sessionId ? h(Button, { variant: 'primary', icon: Icons.plus(15), onClick: () => { setEditorError(null); setEditor({ host: null }) } }, t('add')) : null)

      const rows = hosts.map((host) => h('div', { className: 'sshm-row', key: host.id },
        h('div', { className: 'sshm-glyph' }, Icons.server(17)),
        h('div', { className: 'sshm-row-main' },
          h('div', { className: 'sshm-row-title' },
            h('span', { className: 'sshm-name' }, host.name),
            h(StatusPill, { online: statuses[host.id], t }),
            host.hasPassword ? h('span', { className: 'sshm-key', title: t('passwordStored') }, Icons.key(13)) : null),
          h('div', { className: 'sshm-mono' }, (host.user ? host.user + '@' : '') + host.host + (Number(host.port) && Number(host.port) !== 22 ? ':' + host.port : '')),
          host.note || host.root ? h('div', { className: 'sshm-note' }, [host.note, host.root ? 'root: ' + host.root : ''].filter(Boolean).join(' · ')) : null),
        h('div', { className: 'sshm-row-actions' },
          h(Button, { variant: 'ghost', icon: Icons.refresh(14), title: t('test'), onClick: () => testHost(host) }),
          h(Button, { variant: 'ghost', icon: Icons.pencil(14), title: t('edit'), onClick: () => { setEditorError(null); setEditor({ host }) } }),
          h(Button, { variant: 'ghost', icon: Icons.trash(14), title: t('remove'), onClick: () => setConfirm(host) }))))

      const listBlock = loading && !state ? skeletons : hosts.length === 0 ? emptyState : h('div', { className: 'sshm-list' }, rows)

      return h('div', { className: 'sshm-page' },
        h('div', { className: 'sshm-shell' },
          header,
          !sessionId ? h('div', { className: 'sshm-alert' }, t('noSession')) : null,
          error ? h('div', { className: 'sshm-alert' }, interp(t('failed'), { message: error })) : null,
          listBlock,
          editor ? h(HostEditor, {
            t,
            host: editor.host,
            busy,
            error: editorError,
            onCancel: () => { setEditor(null); setEditorError(null) },
            onSave: saveHost,
          }) : null,
          confirm ? h(Modal, {
            title: t('deleteTitle'),
            onClose: () => setConfirm(null),
            footer: [
              h(Button, { key: 'cancel', variant: 'ghost', onClick: () => setConfirm(null) }, t('cancel')),
              h(Button, { key: 'delete', variant: 'primary', disabled: busy, onClick: () => deleteHost(confirm) }, t('confirm')),
            ],
          }, h('div', { className: 'sshm-modal-body' }, h('div', { className: 'sshm-field-full sshm-hint' }, interp(t('deleteBody'), { name: confirm.name })))) : null,
          h(Toast, { toast, onDone: () => setToast(null) })))
    }

    // --- session picker -----------------------------------------------------
    function HostPicker(props) {
      const { ctx, t, sessionId } = props
      const { state, statuses, error, reload } = useHosts(ctx, sessionId)
      const [open, setOpen] = React.useState(false)
      const [busy, setBusy] = React.useState(false)
      const [toast, setToast] = React.useState(null)
      const wrap = React.useRef(null)

      React.useEffect(() => {
        if (!open) return undefined
        const close = (event) => {
          if (wrap.current && !wrap.current.contains(event.target)) setOpen(false)
        }
        document.addEventListener('pointerdown', close)
        return () => document.removeEventListener('pointerdown', close)
      }, [open])

      const hosts = state && Array.isArray(state.hosts) ? state.hosts : []
      const granted = new Set(state && Array.isArray(state.grants) ? state.grants : [])

      async function toggle(hostId) {
        const next = new Set(granted)
        if (next.has(hostId)) next.delete(hostId)
        else next.add(hostId)
        setBusy(true)
        try {
          await callHost(ctx, sessionId, { op: 'grants.set', hosts: [...next] }, new AbortController().signal)
          reload()
        } catch (failure) {
          setToast({ ok: false, text: interp(t('failed'), { message: failure && failure.message ? failure.message : String(failure) }) })
        } finally {
          setBusy(false)
        }
      }

      function openManage() {
        try {
          if (ctx.layout && typeof ctx.layout.selectPanel === 'function') ctx.layout.selectPanel(PANEL_ID)
        } catch (error) {}
        setOpen(false)
      }

      return h('div', { className: 'sshm-picker', ref: wrap },
        h('button', {
          type: 'button',
          className: 'sshm-chip' + (granted.size > 0 ? ' sshm-chip-on' : ''),
          onClick: () => setOpen((value) => !value),
          title: t('picker'),
        },
          h('span', { className: 'sshm-dot', style: { background: granted.size > 0 ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-idle-primary)' } }),
          t('picker'),
          granted.size > 0 ? h('span', { className: 'sshm-chip-badge' }, interp(t('pickerBadge'), { n: granted.size })) : null),
        open ? h('div', { className: 'sshm-popover' },
          h('div', { className: 'sshm-pop-head' },
            h('div', { className: 'sshm-pop-title' }, t('pickerTitle')),
            h('div', { className: 'sshm-pop-hint' }, t('pickerHint'))),
          hosts.length === 0
            ? h('div', { className: 'sshm-status' }, t('pickerEmpty'))
            : h('div', { className: 'sshm-pop-list' }, hosts.map((host) => h('div', {
              className: 'sshm-host-row',
              key: host.id,
              onClick: () => { if (!busy) toggle(host.id) },
            },
              h('span', { className: 'sshm-dot', style: { background: statuses[host.id] ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-idle-primary)' } }),
              h('div', { className: 'sshm-host-main' },
                h('div', { className: 'sshm-host-name' }, host.name, host.hasPassword ? h('span', { className: 'sshm-key' }, Icons.key(12)) : null),
                h('div', { className: 'sshm-host-target' }, (host.user ? host.user + '@' : '') + host.host)),
              h('span', { className: 'sshm-switch' + (granted.has(host.id) ? ' sshm-switch-on' : ''), role: 'switch', 'aria-checked': granted.has(host.id), title: t('granted') }),
              h(Button, { variant: 'ghost', icon: Icons.folder(14), title: t('openFilesTitle'), onClick: (event) => { event.stopPropagation(); openHostFiles(ctx, sessionId, host.id); setOpen(false) } })))),
          error ? h('div', { className: 'sshm-status sshm-status-error' }, interp(t('failed'), { message: error })) : null,
          h('div', { className: 'sshm-pop-foot' },
            h('span', null, granted.size === 0 ? t('pickerHint') : interp(t('pickerBadge'), { n: granted.size }) + ' / ' + hosts.length),
            h('button', { type: 'button', className: 'sshm-link', onClick: openManage }, t('manage'))))
          : null,
        h(Toast, { toast, onDone: () => setToast(null) }))
    }

    // --- host chooser (right sidebar, no host selected) --------------------
    function HostChooser({ ctx, t, sessionId, state, statuses, error, loading }) {
      const hosts = state && Array.isArray(state.hosts) ? state.hosts : []
      const granted = new Set(state && Array.isArray(state.grants) ? state.grants : [])
      const authorized = hosts.filter((host) => granted.has(host.id))
      return h('div', { className: 'sshm-files' },
        h('div', { className: 'sshm-toolbar' },
          h('span', { className: 'sshm-toolbar-host' }, Icons.server(15), t('chooserTitle')),
          h('span', { className: 'sshm-hint' }, t('chooserHint'))),
        h('div', { className: 'sshm-file-list' },
          loading && !state ? h('div', { className: 'sshm-skeleton' }, h('div', { className: 'sshm-sk', style: { width: '70%' } })) : null,
          error ? h('div', { className: 'sshm-status sshm-status-error' }, interp(t('failed'), { message: error })) : null,
          !loading && authorized.length === 0
            ? h('div', { className: 'sshm-empty' },
              h('div', { className: 'sshm-empty-icon' }, Icons.server(20)),
              h('div', { className: 'sshm-empty-title' }, t('chooserEmpty')),
              h('div', { className: 'sshm-empty-text' }, t('chooserHint')))
            : authorized.map((host) => h('div', { className: 'sshm-file-row', key: host.id, onClick: () => openHostFiles(ctx, sessionId, host.id) },
              h('span', { className: 'sshm-file-icon' }, Icons.server(15)),
              h('span', { className: 'sshm-file-name' }, host.name),
              h('span', { className: 'sshm-file-meta' }, (host.user ? host.user + '@' : '') + host.host),
              h(StatusPill, { online: statuses[host.id], t })))))
    }

    // --- remote browser -----------------------------------------------------
    function RemoteBrowser({ ctx, sessionId, host, t, inputActions }) {
      const startPath = host.root && host.root.startsWith('/') ? host.root : '/'
      const [path, setPath] = React.useState(startPath)
      const [listing, setListing] = React.useState({ loading: true, entries: [], error: null })
      const [preview, setPreview] = React.useState(null)
      const [menu, setMenu] = React.useState(null)
      const [dialog, setDialog] = React.useState(null)
      const [toast, setToast] = React.useState(null)
      const [tick, setTick] = React.useState(0)

      React.useEffect(() => {
        const controller = new AbortController()
        setListing((current) => ({ ...current, loading: true, error: null }))
        ;(async () => {
          try {
            const result = await callHost(ctx, sessionId, { op: 'files.ls', hostId: host.id, path }, controller.signal)
            if (controller.signal.aborted) return
            if (result.kind === 'file') {
              setListing({ loading: false, entries: [], error: null })
              return
            }
            setListing({ loading: false, entries: result.entries || [], error: null })
          } catch (failure) {
            if (!controller.signal.aborted) setListing({ loading: false, entries: [], error: failure && failure.message ? failure.message : String(failure) })
          }
        })()
        return () => controller.abort()
      }, [ctx, sessionId, host.id, path, tick])

      React.useEffect(() => {
        if (!menu && !dialog) return undefined
        const onKey = (event) => {
          if (event.key === 'Escape') {
            setMenu(null)
            setDialog(null)
          }
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
      }, [menu, dialog])

      const entries = listing.entries

      async function readPreview(target) {
        setPreview({ loading: true, path: target, text: '', error: null })
        try {
          const file = await callHost(ctx, sessionId, { op: 'files.read', hostId: host.id, path: target, maxBytes: 65536 }, new AbortController().signal)
          setPreview({ loading: false, path: file.path, text: file.text, truncated: file.truncated, binary: file.binary, error: null })
        } catch (failure) {
          setPreview({ loading: false, path: target, text: '', error: failure && failure.message ? failure.message : String(failure) })
        }
      }

      function openEntry(entry) {
        if (entry.type === 'directory') {
          setPath(joinRemote(path, entry.name).replace(/\/+/g, '/'))
          setPreview(null)
          return
        }
        readPreview(joinRemote(path, entry.name).replace(/\/+/g, '/'))
      }

      async function runFile(action, success) {
        setToast(null)
        try {
          const result = await action()
          if (success) setToast({ ok: true, text: interp(success, { path: (result && (result.localPath || result.remotePath || result.path)) || '' }) })
          setTick((value) => value + 1)
        } catch (failure) {
          setToast({ ok: false, text: interp(t('actionFailed'), { message: failure && failure.message ? failure.message : String(failure) }) })
        } finally {
          setDialog(null)
          setMenu(null)
        }
      }

      function targetPath(name) {
        return joinRemote(path, name).replace(/\/+/g, '/')
      }

      const crumbs = path.split('/').filter(Boolean)
      let accumulated = ''
      const crumbNodes = [h('span', { className: 'sshm-crumb', key: 'root', onClick: () => setPath('/') }, '/')]
      for (const part of crumbs) {
        accumulated += '/' + part
        const target = accumulated
        crumbNodes.push(h('span', { className: 'sshm-sep', key: target + '.', }, '/'))
        crumbNodes.push(h('span', { className: 'sshm-crumb', key: target, onClick: () => setPath(target) }, part))
      }

      const menuItems = []
      if (menu) {
        const entry = menu.entry
        const entryPath = entry ? targetPath(entry.name) : path
        const item = (key, icon, label, onClick, danger) => menuItems.push(h('div', {
          key,
          className: 'sshm-menu-item' + (danger ? ' sshm-menu-danger' : ''),
          onClick,
        }, icon, label))
        if (entry) {
          item('insert', Icons.insert(14), t('insert'), () => {
            insertReference({ inputActions, t }, host, entryPath, (result) => setToast(result))
            setMenu(null)
          })
          if (entry.type !== 'directory') item('download', Icons.download(14), t('download'), () => runFile(() => callHost(ctx, sessionId, { op: 'files.download', hostId: host.id, path: entryPath }, new AbortController().signal), t('downloaded')))
          menuItems.push(h('div', { key: 'sep', className: 'sshm-menu-sep' }))
          item('rename', Icons.pencil(14), t('rename'), () => setDialog({ kind: 'rename', entry, value: entry.name }))
          item('delete', Icons.trash(14), t('delete'), () => setDialog({ kind: 'delete', entry }), true)
        } else {
          item('mkdir', Icons.plusFolder(14), t('mkdir'), () => setDialog({ kind: 'mkdir', value: '' }))
          item('upload', Icons.upload(14), t('upload'), () => setDialog({ kind: 'upload', value: '' }))
          item('refresh', Icons.refresh(14), t('refresh'), () => { setTick((value) => value + 1); setMenu(null) })
        }
        menuItems.push(h('div', { key: 'sep2', className: 'sshm-menu-sep' }))
        item('copy', Icons.copy(14), t('copyPath'), () => {
          try { navigator.clipboard.writeText(entryPath); setToast({ ok: true, text: t('copyDone') }) } catch (error) { setToast({ ok: false, text: t('copyDone') }) }
          setMenu(null)
        })
      }

      const clampedMenu = menu ? {
        left: Math.min(menu.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 220),
        top: Math.min(menu.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 40 - menuItems.length * 34),
      } : null

      return h('div', { className: 'sshm-files sshm-abs', onContextMenu: (event) => event.preventDefault() },
        h('div', { className: 'sshm-toolbar' },
          h('span', { className: 'sshm-toolbar-host' }, Icons.server(15), host.name),
          h(Button, { variant: 'ghost', icon: Icons.up(14), title: t('up'), disabled: path === '/', onClick: () => {
            const parent = path.replace(/\/+$/, '')
            const index = parent.lastIndexOf('/')
            setPath(index <= 0 ? '/' : parent.slice(0, index))
          } }),
          h('div', { className: 'sshm-crumbs' }, ...crumbNodes),
          h(Button, { variant: 'ghost', icon: Icons.refresh(14), title: t('refresh'), disabled: listing.loading, onClick: () => setTick((value) => value + 1) })),
        h('div', { className: 'sshm-file-list' },
          listing.loading && entries.length === 0
            ? [0, 1, 2, 3].map((index) => h('div', { className: 'sshm-skeleton', key: 'sk' + index },
              h('div', { className: 'sshm-sk', style: { width: '18px', height: '18px', borderRadius: '5px' } }),
              h('div', { className: 'sshm-sk', style: { width: (140 + index * 23) + 'px' } })))
            : null,
          listing.error ? h('div', { className: 'sshm-status sshm-status-error' }, interp(t('failed'), { message: listing.error })) : null,
          !listing.loading && !listing.error && entries.length === 0
            ? h('div', { className: 'sshm-empty' },
              h('div', { className: 'sshm-empty-icon' }, Icons.folder(20)),
              h('div', { className: 'sshm-empty-title' }, t('emptyDir')))
            : entries.map((entry) => h('div', {
              key: entry.name,
              className: 'sshm-file-row',
              onClick: () => openEntry(entry),
              onContextMenu: (event) => {
                event.preventDefault()
                event.stopPropagation()
                setMenu({ x: event.clientX, y: event.clientY, entry })
              },
            },
              h('span', { className: 'sshm-file-icon' + (entry.type === 'directory' ? ' sshm-file-icon-dir' : '') },
                entry.type === 'directory' ? Icons.folder(15) : Icons.file(15)),
              h('span', { className: 'sshm-file-name' }, entry.name),
              h('span', { className: 'sshm-file-meta' }, entry.type === 'directory' ? '' : formatSize(entry.size)),
              h('span', { className: 'sshm-file-meta', style: { width: '96px', textAlign: 'right' } }, formatTime(Number(entry.mtime) * 1000))))),
        h('div', { className: 'sshm-actions-row' },
          h(Button, { variant: 'ghost', icon: Icons.plusFolder(14), onClick: (event) => { event.stopPropagation(); setDialog({ kind: 'mkdir', value: '' }) } }, t('mkdir')),
          h(Button, { variant: 'ghost', icon: Icons.upload(14), onClick: (event) => { event.stopPropagation(); setDialog({ kind: 'upload', value: '' }) } }, t('upload'))),
        preview ? h('div', { className: 'sshm-preview' },
          h('div', { className: 'sshm-preview-head' },
            h('span', { className: 'sshm-preview-name' }, preview.path),
            preview.truncated ? h('span', { className: 'sshm-pill' }, t('truncated')) : null,
            h(Button, { variant: 'ghost', icon: Icons.x(14), title: t('close'), onClick: () => setPreview(null) })),
          preview.loading ? h('div', { className: 'sshm-status' }, t('loading')) : null,
          preview.error ? h('div', { className: 'sshm-status sshm-status-error' }, preview.error) : null,
          preview.binary ? h('div', { className: 'sshm-status' }, t('binary')) : null,
          !preview.loading && !preview.error && !preview.binary ? h('pre', { className: 'sshm-pre' }, preview.text) : null) : null,
        menu ? h('div', { className: 'sshm-menu-overlay', onClick: () => setMenu(null), onContextMenu: (event) => { event.preventDefault(); setMenu(null) } }) : null,
        menu ? h('div', { className: 'sshm-menu', style: clampedMenu, onClick: (event) => event.stopPropagation() }, menuItems) : null,
        dialog && dialog.kind === 'delete'
          ? h(Modal, {
            title: t('deleteFileTitle'),
            onClose: () => setDialog(null),
            footer: [
              h(Button, { key: 'cancel', variant: 'ghost', onClick: () => setDialog(null) }, t('cancel')),
              h(Button, { key: 'ok', variant: 'primary', onClick: () => runFile(() => callHost(ctx, sessionId, { op: 'files.remove', hostId: host.id, path: targetPath(dialog.entry.name) }, new AbortController().signal)) }, t('confirm')),
            ],
          }, h('div', { className: 'sshm-modal-body' }, h('div', { className: 'sshm-field-full sshm-hint' }, interp(t('deleteFileBody'), { path: targetPath(dialog.entry.name) }))))
          : null,
        dialog && dialog.kind !== 'delete'
          ? h(Modal, {
            title: dialog.kind === 'rename' ? t('rename') : dialog.kind === 'upload' ? t('upload') : t('mkdir'),
            onClose: () => setDialog(null),
            footer: [
              h(Button, { key: 'cancel', variant: 'ghost', onClick: () => setDialog(null) }, t('cancel')),
              h(Button, { key: 'ok', variant: 'primary', onClick: () => {
                const value = String(dialog.value || '').trim()
                if (value === '') return
                if (dialog.kind === 'mkdir') runFile(() => callHost(ctx, sessionId, { op: 'files.mkdir', hostId: host.id, path: targetPath(value) }, new AbortController().signal))
                else if (dialog.kind === 'rename') runFile(() => callHost(ctx, sessionId, { op: 'files.rename', hostId: host.id, path: targetPath(dialog.entry.name), to: targetPath(value) }, new AbortController().signal))
                else if (dialog.kind === 'upload') {
                  const name = value.split(/[\\/]/).filter(Boolean).pop() || 'upload.bin'
                  runFile(() => callHost(ctx, sessionId, { op: 'files.upload', hostId: host.id, localPath: value, remotePath: targetPath(name) }, new AbortController().signal), t('uploaded'))
                }
              } }, t('confirm')),
            ],
          }, h('div', { className: 'sshm-modal-body' },
            h(Field, {
              label: dialog.kind === 'upload' ? t('localPath') : t('newName'),
              value: dialog.value || '',
              onChange: (value) => setDialog({ ...dialog, value }),
              hint: dialog.kind === 'upload' ? t('localPathHint') : null,
              full: true,
              autoFocus: true,
            })))
          : null,
        h(Toast, { toast, onDone: () => setToast(null) }))
    }

    function SshFilesBody(props) {
      const { ctx, t } = props
      const tabInfo = props.useTabInfo ? props.useTabInfo() : { tab: undefined }
      const tab = tabInfo && tabInfo.tab
      const hostId = tab && tab.navigation && tab.navigation.params ? tab.navigation.params.hostId : undefined
      const { state, statuses, error, loading } = useHosts(ctx, props.sessionId)
      if (!hostId) return h(HostChooser, { ctx, t, sessionId: props.sessionId, state, statuses, error, loading })
      const hosts = state && Array.isArray(state.hosts) ? state.hosts : []
      const host = hosts.find((item) => item.id === hostId)
      if (!host) {
        return h('div', { className: 'sshm-files' }, h('div', { className: 'sshm-status' }, loading ? t('loading') : interp(t('failed'), { message: hostId })))
      }
      return h(RemoteBrowser, { key: host.id, ctx, sessionId: props.sessionId, host, t, inputActions: props.inputActions })
    }

    function PanelIcon({ size }) {
      return Icons.server(size || 20)
    }

    // The UI talks to the Host through the plugin's `ssh-manager` command. Those
    // command lifecycle rows are plumbing, not conversation: render nothing for
    // this command name so the Chat transcript stays clean.
    function HiddenCommandRow() {
      return null
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ssh-manager.copy')
      ctx.effect(() => {
        const tag = document.createElement('style')
        tag.setAttribute('data-ssh-manager', '')
        tag.textContent = CSS
        document.head.appendChild(tag)
        return () => tag.remove()
      }, 'ssh-manager.styles')
      const translate = ctx.locale.bind(NS)
      const tr = (key, params) => interp(translate(key), params)

      ctx.effect(() => ctx.sidebarRightTabs.register({
        id: FILES_ID,
        kind: 'ssh-files',
        priority: 'builtin',
        multiple: true,
        title: () => tr('filesTitle'),
        guide: [{ id: 'remote-files', order: 27, title: () => tr('filesTitle'), description: () => tr('filesDesc') }],
      }), 'ssh-manager.files-type')

      ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
        name: 'sidebar.right.pane.tab',
        key: FILES_ID,
        locale: NS,
      }, (props) => h(SshFilesBody, { ...props, ctx, t: tr }))), 'ssh-manager.files-body')

      ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: PANEL_ID,
        locale: NS,
      }, (props) => h(ManagementPage, { ...props, ctx, t: tr }))), 'ssh-manager.page')

      ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: 20,
        label: () => tr('panel'),
        locale: NS,
      }, PanelIcon)), 'ssh-manager.panel-icon')

      ctx.effect(() => ctx.slots.inject('conversation.chat.commandview', () => ctx.slots.register({
        name: 'conversation.chat.commandview',
        key: 'ssh-manager',
        locale: NS,
      }, HiddenCommandRow)), 'ssh-manager.hidden-command')

      ctx.effect(() => ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
        name: 'conversation.input.left',
        id: 'ssh-manager-hosts',
        order: 25,
        label: () => tr('picker'),
      }, (props) => h(HostPicker, { ...props, ctx, t: tr }))), 'ssh-manager.picker')
    }

    return { inject: ['slots', 'locale', 'sidebarRight', 'sidebarRightTabs', 'remote', 'remote.commands', 'remote.credentials', 'layout'], apply }
  },
})
