/* TodoFlow — Beautiful version (Vanilla JS) */
(function(){
  const $ = (sel, el=document) => el.querySelector(sel);
  const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));

  const els = {
    form: $('#newTaskForm'),
    title: $('#taskTitle'),
    due: $('#taskDue'),
    priority: $('#taskPriority'),
    list: $('#taskList'),
    template: $('#taskItemTemplate'),
    count: $('#count'),
    clearCompleted: $('#clearCompleted'),
    chips: $$('.chip'),
    search: $('#searchInput'),
    themeToggle: $('#themeToggle'),
    
  };

  const STORAGE_KEY = 'todoflow.v2.tasks';
  const THEME_KEY = 'todoflow.theme';

  /** Model **/
  let tasks = loadTasks();

  function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
  function loadTasks(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : demoTasks();
    }catch{ return demoTasks(); }
  }
  function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }

  function demoTasks(){
    const today = new Date().toISOString().slice(0,10);
    return [
      {id: uid(), title:'Finish the project proposal', completed:false, due: today, priority:'p1', sort: 0},
      {id: uid(), title:'Buy groceries (milk, eggs, veggies)', completed:false, due:'', priority:'p2', sort: 1},
      {id: uid(), title:'Read 10 pages of a book', completed:true, due:'', priority:'p3', sort: 2},
    ];
  }

  /** View **/
  function render(){
    const activeFilter = $('.chip.active')?.dataset.filter || 'all';
    const q = els.search.value.trim().toLowerCase();
    const todayStr = new Date().toISOString().slice(0,10);

    const filtered = tasks
      .slice()
      .sort((a,b) => (a.sort ?? 0) - (b.sort ?? 0))
      .filter(t => {
        const matchesQ = !q || t.title.toLowerCase().includes(q);
        let matchesF = true;
        if(activeFilter === 'active') matchesF = !t.completed;
        if(activeFilter === 'completed') matchesF = t.completed;
        if(activeFilter === 'today') matchesF = t.due === todayStr;
        if(activeFilter === 'overdue') matchesF = t.due && t.due < todayStr && !t.completed;
        if(activeFilter === 'high') matchesF = t.priority === 'p1';
        return matchesQ && matchesF;
      });

    els.list.innerHTML = '';
    filtered.forEach((t, i) => {
      const item = taskItem(t);
      item.style.animationDelay = (i * 30) + 'ms'; // staggered pop
      els.list.appendChild(item);
    });

    const countActive = tasks.filter(t => !t.completed).length;
    els.count.textContent = `${countActive} item${countActive!==1?'s':''} left`;
    save();
  }

  function taskItem(t){
    const node = els.template.content.firstElementChild.cloneNode(true);
    node.dataset.id = t.id;
    if(t.completed) node.classList.add('completed');
    $('.toggle', node).checked = t.completed;
    $('.title', node).textContent = t.title;
    const dueEl = $('.due', node);
    dueEl.textContent = t.due ? ('Due ' + formatDate(t.due)) : 'No due date';
    const prEl = $('.priority', node);
    prEl.textContent = priorityLabel(t.priority);
    prEl.dataset.level = t.priority;

    node.setAttribute('draggable', 'true');

    // Inline edit
    $('.title', node).addEventListener('input', e => {
      const v = e.currentTarget.textContent.trim();
      update(t.id, {title: v});
    });

    // Toggle complete
    $('.toggle', node).addEventListener('change', e => {
      update(t.id, {completed: e.currentTarget.checked});
      node.classList.toggle('completed', e.currentTarget.checked);
      render();
    });

    // Actions
    node.addEventListener('click', e => {
      const btn = e.target.closest('button[data-action]');
      if(!btn) return;
      const action = btn.dataset.action;
      if(action === 'delete'){
        // Soft fade before removal
        node.style.transition = 'transform .12s ease, opacity .18s ease';
        node.style.transform = 'scale(0.98)';
        node.style.opacity = '0';
        setTimeout(()=>{
          tasks = tasks.filter(x => x.id !== t.id);
          render();
        }, 160);
      }else if(action === 'duplicate'){
        const clone = {...t, id: uid(), title: t.title + ' (copy)', sort: (maxSort()+1)};
        tasks.push(clone); render();
      }
    });

    // Drag & drop reordering
    node.addEventListener('dragstart', (e)=>{
      node.setAttribute('aria-grabbed','true');
      e.dataTransfer.setData('text/plain', t.id);
      e.dataTransfer.effectAllowed = 'move';
    });
    node.addEventListener('dragend', ()=> node.removeAttribute('aria-grabbed'));
    node.addEventListener('dragover', (e)=>{
      e.preventDefault();
      const draggingId = e.dataTransfer.getData('text/plain');
      if(!draggingId || draggingId===t.id) return;
      const draggingEl = els.list.querySelector(`[data-id="${draggingId}"]`);
      const rect = node.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height/2;
      els.list.insertBefore(draggingEl, before ? node : node.nextSibling);
    });
    node.addEventListener('drop', ()=>{
      $$('.task', els.list).forEach((li, i)=>{
        const id = li.dataset.id;
        const item = tasks.find(x=>x.id===id);
        if(item){ item.sort = i; }
      });
      render();
    });

    return node;
  }

  function update(id, patch){
    const i = tasks.findIndex(t => t.id===id);
    if(i>-1){
      tasks[i] = {...tasks[i], ...patch};
      save();
    }
  }
  function maxSort(){ return tasks.reduce((m,t)=> Math.max(m, t.sort ?? 0), -1); }
  function addTask({title, due, priority}){
    tasks.push({ id: uid(), title: title.trim(), completed: false, due: due || '', priority: priority || 'p2', sort: maxSort()+1 });
    render();
  }
  function priorityLabel(p){ return p==='p1' ? 'High' : p==='p3' ? 'Low' : 'Medium'; }
  function formatDate(s){
    try{ const d = new Date(s + 'T00:00:00'); return d.toLocaleDateString(undefined, {year:'numeric', month:'short', day:'numeric'}); }
    catch{ return s; }
  }

  /** Events **/
  els.form.addEventListener('submit', (e)=>{
    e.preventDefault();
    if(!els.title.value.trim()) return;
    addTask({title: els.title.value, due: els.due.value, priority: els.priority.value});
    els.title.value=''; els.due.value=''; els.priority.value='p2';
    els.title.focus();
  });

  els.clearCompleted.addEventListener('click', ()=>{
    tasks = tasks.filter(t => !t.completed);
    render();
  });

  els.chips.forEach(chip => chip.addEventListener('click', ()=>{
    els.chips.forEach(c => { c.classList.remove('active'); c.setAttribute('aria-selected','false'); });
    chip.classList.add('active'); chip.setAttribute('aria-selected','true');
    render();
  }));

  els.search.addEventListener('input', render);

 

  // Theme
  const initialTheme = localStorage.getItem(THEME_KEY) || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  if(initialTheme==='light') document.documentElement.classList.add('light');
  els.themeToggle.textContent = initialTheme==='light' ? '🌞' : '🌙';
  els.themeToggle.addEventListener('click', ()=>{
    document.documentElement.classList.toggle('light');
    const isLight = document.documentElement.classList.contains('light');
    localStorage.setItem(THEME_KEY, isLight ? 'light' : 'dark');
    els.themeToggle.textContent = isLight ? '🌞' : '🌙';
  });



  render();
})();