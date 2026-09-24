/**
 * RepoClaw 高质感暗黑极客风 Web 视图生成器
 * 融合赛博科技美学、磨砂玻璃与高辨识度视觉资产，告别廉价 AI 感
 */

export function renderLandingPage(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RepoClaw - 自主 Bug 复现数字维护者</title>
  <link rel="icon" type="image/jpeg" href="/images/logo.jpg">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', 'sans-serif'],
            mono: ['JetBrains Mono', 'monospace'],
          },
          colors: {
            brand: {
              cyan: '#00f2fe',
              purple: '#9d4edd',
              dark: '#0a0d14',
              card: '#111622',
              border: 'rgba(255, 255, 255, 0.08)'
            }
          }
        }
      }
    }
  </script>
  <style>
    body {
      background-color: #07090e;
      color: #f1f5f9;
      background-image: 
        radial-gradient(at 0% 0%, rgba(0, 242, 254, 0.08) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(157, 78, 221, 0.08) 0px, transparent 50%);
      background-attachment: fixed;
    }
    .glass-panel {
      background: rgba(17, 22, 34, 0.75);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .neon-glow {
      box-shadow: 0 0 40px -10px rgba(0, 242, 254, 0.25);
    }
  </style>
</head>
<body class="font-sans antialiased min-h-screen flex flex-col justify-between selection:bg-cyan-500 selection:text-black">
  <!-- 导航栏 -->
  <header class="border-b border-white/5 sticky top-0 z-50 bg-[#07090e]/80 backdrop-blur-md">
    <div class="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between py-4">
      <div class="flex items-center gap-3">
        <img src="/images/logo.jpg" alt="RepoClaw Logo" class="w-10 h-10 rounded-xl border border-cyan-500/40 shadow-lg shadow-cyan-500/20 object-cover">
        <div>
          <span class="text-xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">RepoClaw</span>
          <span class="ml-2 text-xs uppercase px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-500/30">v1.0 Production</span>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <a href="/dashboard" class="text-sm font-medium text-slate-300 hover:text-cyan-400 transition-colors">
          📊 审计看板
        </a>
        <a href="https://github.com" target="_blank" class="px-4 py-2 text-sm font-semibold rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all flex items-center gap-2">
          <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          GitHub
        </a>
      </div>
    </div>
  </header>

  <!-- Hero 主体区域 -->
  <main class="max-w-7xl mx-auto px-6 py-16 flex-1 flex flex-col justify-center">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
      <div class="lg:col-span-7 space-y-6">
        <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel border-cyan-500/30 text-xs font-mono text-cyan-300">
          <span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          零信任 Docker 沙箱 + SWE-bench 级自愈状态机
        </div>
        <h1 class="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
          把模糊的 Bug Issue，<br>
          变为<span class="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-purple-400">可执行的验证代码</span>。
        </h1>
        <p class="text-lg text-slate-400 leading-relaxed max-w-2xl">
          RepoClaw 是常驻 GitHub 的 AI 协作维护者。只需在评论区发送 <code class="text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded font-mono border border-cyan-800/40">@repoclaw repro</code>，它即刻在受限容器中推导意图、自愈修复并提取最小复现脚本，自动打标打通闭环。
        </p>
        
        <!-- 操作按钮组 -->
        <div class="flex flex-wrap items-center gap-4 pt-4">
          <a href="/dashboard" class="px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold transition-all shadow-lg shadow-cyan-500/20 flex items-center gap-2">
            <span>进入任务审计看板</span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          </a>
          <a href="https://github.com/apps/repoclaw-app" target="_blank" class="px-6 py-3.5 rounded-xl glass-panel hover:bg-white/10 text-white font-medium transition-all flex items-center gap-2 border border-cyan-500/30 shadow-lg shadow-cyan-500/10">
            <span>⚡ 安装至 GitHub 仓库</span>
          </a>
        </div>

        <!-- 极客终端交互示范 -->
        <div class="glass-panel rounded-xl p-4 font-mono text-xs text-slate-300 space-y-2 border-white/10 max-w-xl shadow-2xl">
          <div class="flex items-center justify-between pb-2 border-b border-white/5 text-slate-500 text-[11px]">
            <span>ChatOps Interactive Demonstration</span>
            <span class="text-emerald-400">● LIVE RUNNER</span>
          </div>
          <p><span class="text-purple-400">maintainer@github</span>:~$ <span class="text-cyan-300">@repoclaw repro</span> 请协助复现除零异常</p>
          <p class="text-slate-500">>> [RepoClaw Gateway]: 维护者鉴权通过，已添加 👀 并在沙箱中启动自愈反思...</p>
          <p class="text-emerald-400">>> [Verified]: 成功复现 ZeroDivisionError，已回帖 repro.py 并打标 [reproduced] 🚀</p>
        </div>
      </div>

      <!-- 右侧概念视觉大图 -->
      <div class="lg:col-span-5 relative">
        <div class="relative rounded-2xl overflow-hidden glass-panel border border-cyan-500/30 neon-glow group">
          <img src="/images/banner.jpg" alt="RepoClaw Secure Sandbox Visual" class="w-full h-auto object-cover transform group-hover:scale-105 transition-transform duration-700">
          <div class="absolute inset-0 bg-gradient-to-t from-[#07090e] via-transparent to-transparent opacity-80"></div>
          <div class="absolute bottom-4 left-4 right-4 p-4 glass-panel rounded-xl border border-white/10">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs font-mono uppercase text-cyan-400">Zero-Trust Sandbox</p>
                <p class="text-sm font-semibold text-white">断网隔离 · 只读挂载 · 30s 硬熔断</p>
              </div>
              <span class="px-2.5 py-1 rounded-full text-xs font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">SECURE</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 三大硬核特性卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20">
      <div class="glass-panel p-6 rounded-2xl border-white/5 hover:border-cyan-500/30 transition-all group">
        <div class="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 group-hover:scale-110 transition-transform">
          🛡️
        </div>
        <h3 class="text-lg font-bold text-white mb-2">零信任受限沙箱</h3>
        <p class="text-sm text-slate-400 leading-relaxed">绝对断网（NetworkMode: none）、代码只读挂载、64MB 临时 tmpfs 内存卷与 30 秒超时强杀，彻底杜绝恶意代码逃逸。</p>
      </div>

      <div class="glass-panel p-6 rounded-2xl border-white/5 hover:border-purple-500/30 transition-all group">
        <div class="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4 group-hover:scale-110 transition-transform">
          🧠
        </div>
        <h3 class="text-lg font-bold text-white mb-2">SWE-bench 级自愈反思</h3>
        <p class="text-sm text-slate-400 leading-relaxed">吸收工业级 Traceback 栈帧提取算法，运行失败时自动将真实堆栈反哺给大模型，进行最多 3 轮变异自愈直至捕获真凶。</p>
      </div>

      <div class="glass-panel p-6 rounded-2xl border-white/5 hover:border-blue-500/30 transition-all group">
        <div class="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4 group-hover:scale-110 transition-transform">
          ⚡
        </div>
        <h3 class="text-lg font-bold text-white mb-2">极速 ChatOps 交互</h3>
        <p class="text-sm text-slate-400 leading-relaxed">维护者直接在 Issue 评论区触发，1.5 秒即时添加 👀 反应，BullMQ 削峰处理，成功后自动回写折叠报告与 🚀 反应。</p>
      </div>
    </div>
  </main>

  <!-- 页脚 -->
  <footer class="border-t border-white/5 py-8 text-center text-xs text-slate-500 font-mono">
    <div class="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
      <span>RepoClaw © 2026. Released under MIT License.</span>
      <span>Autonomous Bug Reproducer & Test Synthesizer for GitHub</span>
    </div>
  </footer>
</body>
</html>`;
}

export function renderDashboardPage(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RepoClaw - 实时任务审计看板</title>
  <link rel="icon" type="image/jpeg" href="/images/logo.jpg">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', 'sans-serif'],
            mono: ['JetBrains Mono', 'monospace'],
          }
        }
      }
    }
  </script>
  <style>
    body {
      background-color: #07090e;
      color: #f1f5f9;
      background-image: 
        radial-gradient(at 0% 0%, rgba(0, 242, 254, 0.05) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(157, 78, 221, 0.05) 0px, transparent 50%);
      background-attachment: fixed;
    }
    .glass-panel {
      background: rgba(17, 22, 34, 0.75);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
  </style>
</head>
<body class="font-sans antialiased min-h-screen flex flex-col justify-between">
  <!-- 顶部导航 -->
  <header class="border-b border-white/5 sticky top-0 z-40 bg-[#07090e]/85 backdrop-blur-md">
    <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <a href="/" class="flex items-center gap-3 group">
          <img src="/images/logo.jpg" alt="Logo" class="w-8 h-8 rounded-lg border border-cyan-500/40 object-cover">
          <span class="font-bold text-lg text-white group-hover:text-cyan-400 transition-colors">RepoClaw</span>
        </a>
        <span class="text-slate-600">/</span>
        <span class="text-sm font-medium text-slate-400">Live Task Dashboard</span>
      </div>
      <div class="flex items-center gap-4">
        <button id="refreshBtn" onclick="loadDashboardData()" class="px-3 py-1.5 text-xs font-mono rounded-lg glass-panel hover:bg-white/10 text-cyan-300 border-cyan-500/30 transition-all flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 animate-spin hidden" id="refreshSpinner" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
          <span id="refreshText">↻ 刷新指标</span>
        </button>
        <a href="/" class="text-xs text-slate-400 hover:text-white transition-colors">返回首页</a>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-6 py-8 flex-1 w-full space-y-8">
    <!-- 顶部 KPI 卡片网格 -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="glass-panel p-5 rounded-xl border-white/5">
        <p class="text-xs font-mono uppercase text-slate-500">累计复现任务数</p>
        <p class="text-3xl font-bold text-white mt-1" id="kpiTotal">-</p>
        <div class="mt-2 flex items-center gap-2 text-xs text-slate-400">
          <span class="w-2 h-2 rounded-full bg-blue-400"></span> 全量 ChatOps 指令
        </div>
      </div>

      <div class="glass-panel p-5 rounded-xl border-white/5">
        <p class="text-xs font-mono uppercase text-slate-500">复现成功率 (Verified)</p>
        <p class="text-3xl font-bold text-emerald-400 mt-1" id="kpiSuccessRate">-%</p>
        <div class="mt-2 flex items-center gap-2 text-xs text-slate-400">
          <span class="w-2 h-2 rounded-full bg-emerald-400"></span> 成功捕获目标异常
        </div>
      </div>

      <div class="glass-panel p-5 rounded-xl border-white/5">
        <p class="text-xs font-mono uppercase text-slate-500">平均沙箱耗时</p>
        <p class="text-3xl font-bold text-cyan-300 mt-1" id="kpiAvgDuration">- ms</p>
        <div class="mt-2 flex items-center gap-2 text-xs text-slate-400">
          <span class="w-2 h-2 rounded-full bg-cyan-400"></span> 包含自愈重试流水
        </div>
      </div>

      <div class="glass-panel p-5 rounded-xl border-white/5">
        <p class="text-xs font-mono uppercase text-slate-500">累计自愈反思轮次</p>
        <p class="text-3xl font-bold text-purple-400 mt-1" id="kpiTotalRetries">-</p>
        <div class="mt-2 flex items-center gap-2 text-xs text-slate-400">
          <span class="w-2 h-2 rounded-full bg-purple-400"></span> 状态机自动修错
        </div>
      </div>
    </div>

    <!-- 任务流水表格卡片 -->
    <div class="glass-panel rounded-xl border-white/5 overflow-hidden shadow-xl">
      <div class="p-4 border-b border-white/5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-base font-semibold text-white">实时任务与审计流水</h2>
          <p class="text-xs text-slate-400 mt-0.5">点击任意任务卡片可展开最小复现脚本、真实堆栈与执行时间线</p>
        </div>
        <div class="flex items-center gap-2">
          <input type="text" id="filterRepo" placeholder="搜索仓库名..." oninput="filterTable()" class="px-3 py-1.5 text-xs rounded-lg bg-black/40 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500">
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-white/[0.02] text-xs font-mono uppercase text-slate-400 border-b border-white/5">
            <tr>
              <th class="px-4 py-3">任务状态</th>
              <th class="px-4 py-3">目标仓库 / Issue</th>
              <th class="px-4 py-3">触发维护者</th>
              <th class="px-4 py-3">目标异常</th>
              <th class="px-4 py-3">重试轮次</th>
              <th class="px-4 py-3">耗时</th>
              <th class="px-4 py-3">触发时间</th>
              <th class="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody id="taskTableBody" class="divide-y divide-white/5 text-slate-300">
            <tr>
              <td colspan="8" class="text-center py-12 text-slate-500 font-mono text-xs">
                正在加载数据...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </main>

  <!-- 任务详情交互抽屉 / 模态框 (Modal) -->
  <div id="detailModal" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm hidden flex items-center justify-center p-4">
    <div class="glass-panel w-full max-w-4xl max-h-[90vh] rounded-2xl flex flex-col border border-white/10 shadow-2xl overflow-hidden">
      <div class="p-5 border-b border-white/10 flex items-center justify-between">
        <div>
          <h3 class="text-lg font-bold text-white flex items-center gap-2">
            <span id="modalTaskStatusBadge"></span>
            <span id="modalTitle">任务详情</span>
          </h3>
          <p class="text-xs font-mono text-slate-400 mt-1" id="modalSubtitle"></p>
        </div>
        <button onclick="closeModal()" class="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors">✕</button>
      </div>

      <div class="p-6 overflow-y-auto space-y-6 text-xs font-mono flex-1">
        <!-- 最小复现脚本 -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-slate-300 font-semibold uppercase tracking-wider text-[11px]">🐍 最小独立复现脚本 (repro.py)</span>
            <button onclick="copyScript()" class="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-cyan-300 transition-colors border border-white/10">一键复制代码</button>
          </div>
          <pre id="modalScript" class="p-4 rounded-xl bg-black/60 border border-white/10 text-cyan-200 overflow-x-auto whitespace-pre-wrap">无脚本记录</pre>
        </div>

        <!-- 真实堆栈 -->
        <div>
          <span class="text-slate-300 font-semibold uppercase tracking-wider text-[11px] block mb-2">🔍 容器沙箱捕获的真实 Traceback 堆栈</span>
          <pre id="modalTraceback" class="p-4 rounded-xl bg-black/60 border border-white/10 text-amber-200 overflow-x-auto whitespace-pre-wrap">无堆栈捕获记录</pre>
        </div>

        <!-- 审计日志时间线 -->
        <div>
          <span class="text-slate-300 font-semibold uppercase tracking-wider text-[11px] block mb-2">📜 状态机生命周期审计流水 (Audit Trail)</span>
          <div id="modalAuditLogs" class="space-y-2">
            <!-- 动态渲染时间线节点 -->
          </div>
        </div>
      </div>
    </div>
  </div>

  <footer class="border-t border-white/5 py-4 text-center text-xs text-slate-500 font-mono">
    RepoClaw Realtime Observability & Audit Dashboard
  </footer>

  <script>
    let currentTasks = [];
    let currentDetailTask = null;

    async function loadDashboardData() {
      const spinner = document.getElementById('refreshSpinner');
      const refreshText = document.getElementById('refreshText');
      spinner.classList.remove('hidden');
      refreshText.textContent = '加载中...';

      try {
        const [statsRes, tasksRes] = await Promise.all([
          fetch('/api/stats').then(r => r.json()),
          fetch('/api/tasks').then(r => r.json())
        ]);

        // 更新 KPI
        document.getElementById('kpiTotal').textContent = statsRes.total || 0;
        document.getElementById('kpiSuccessRate').textContent = (statsRes.successRate || 0) + '%';
        document.getElementById('kpiAvgDuration').textContent = (statsRes.avgDurationMs || 0) + ' ms';
        document.getElementById('kpiTotalRetries').textContent = statsRes.totalRetries || 0;

        // 渲染表格
        currentTasks = tasksRes.tasks || [];
        renderTable(currentTasks);
      } catch (err) {
        console.error('加载看板数据失败:', err);
      } finally {
        spinner.classList.add('hidden');
        refreshText.textContent = '↻ 刷新指标';
      }
    }

    function getStatusBadge(status) {
      if (status === 'VERIFIED') {
        return '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>VERIFIED</span>';
      } else if (status === 'UNVERIFIED') {
        return '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20"><span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>UNVERIFIED</span>';
      } else if (status === 'RUNNING') {
        return '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20"><span class="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>RUNNING</span>';
      } else if (status === 'PENDING') {
        return '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">PENDING</span>';
      }
      return '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">FAILED</span>';
    }

    function renderTable(tasks) {
      const tbody = document.getElementById('taskTableBody');
      if (!tasks.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-12 text-slate-500 font-mono text-xs">暂无复现任务记录。在 GitHub Issue 中评论 <code>@repoclaw repro</code> 即可触发！</td></tr>';
        return;
      }

      tbody.innerHTML = tasks.map(t => {
        const timeStr = new Date(t.createdAt).toLocaleTimeString();
        return \`
          <tr class="hover:bg-white/[0.02] transition-colors cursor-pointer" onclick="openDetailModal('\${t.id}')">
            <td class="px-4 py-3.5 whitespace-nowrap">\${getStatusBadge(t.status)}</td>
            <td class="px-4 py-3.5 font-medium text-white whitespace-nowrap">
              \${t.repoFullName} <span class="text-cyan-400 font-mono text-xs">#\${t.issueNumber}</span>
            </td>
            <td class="px-4 py-3.5 text-slate-400 font-mono text-xs">@\${t.triggerUser}</td>
            <td class="px-4 py-3.5 font-mono text-xs text-amber-300 whitespace-nowrap">\${t.targetException || '-'}</td>
            <td class="px-4 py-3.5 font-mono text-xs text-slate-400">\${t.retryCount} 轮</td>
            <td class="px-4 py-3.5 font-mono text-xs text-cyan-300">\${t.durationMs || 0} ms</td>
            <td class="px-4 py-3.5 font-mono text-xs text-slate-500 whitespace-nowrap">\${timeStr}</td>
            <td class="px-4 py-3.5 text-right whitespace-nowrap">
              <button class="text-xs text-cyan-400 hover:text-cyan-300 font-semibold underline">查看详情</button>
            </td>
          </tr>
        \`;
      }).join('');
    }

    function filterTable() {
      const query = document.getElementById('filterRepo').value.toLowerCase();
      const filtered = currentTasks.filter(t => t.repoFullName.toLowerCase().includes(query));
      renderTable(filtered);
    }

    async function openDetailModal(taskId) {
      const modal = document.getElementById('detailModal');
      modal.classList.remove('hidden');

      try {
        const res = await fetch('/api/tasks/' + taskId).then(r => r.json());
        const task = res.task;
        const logs = res.auditLogs || [];
        currentDetailTask = task;

        document.getElementById('modalTitle').textContent = task.repoFullName + ' #' + task.issueNumber;
        document.getElementById('modalSubtitle').textContent = 'Task ID: ' + task.id + ' | 触发者: @' + task.triggerUser + ' | 耗时: ' + (task.durationMs || 0) + 'ms';
        document.getElementById('modalTaskStatusBadge').innerHTML = getStatusBadge(task.status);
        document.getElementById('modalScript').textContent = task.reproScript || '# 未生成独立复现代码';
        document.getElementById('modalTraceback').textContent = task.actualTraceback || '无错误堆栈输出 (Clean Exit)';

        const logContainer = document.getElementById('modalAuditLogs');
        logContainer.innerHTML = logs.map(l => \`
          <div class="p-2.5 rounded-lg bg-black/40 border border-white/5 flex items-start justify-between gap-4">
            <div>
              <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-400 border border-cyan-800/50">\${l.step}</span>
              <span class="text-slate-300 ml-2 text-xs">\${l.message}</span>
            </div>
            <span class="text-[10px] text-slate-500 whitespace-nowrap">\${new Date(l.createdAt).toLocaleTimeString()}</span>
          </div>
        \`).join('') || '<p class="text-slate-500">无审计日志</p>';
      } catch (err) {
        console.error('获取详情失败:', err);
      }
    }

    function closeModal() {
      document.getElementById('detailModal').classList.add('hidden');
    }

    function copyScript() {
      if (currentDetailTask && currentDetailTask.reproScript) {
        navigator.clipboard.writeText(currentDetailTask.reproScript);
        alert('复现代码已复制到剪贴板！');
      }
    }

    // 初始加载
    loadDashboardData();
    // 每 10 秒自动静默轮询一次
    setInterval(loadDashboardData, 10000);
  </script>
</body>
</html>`;
}
