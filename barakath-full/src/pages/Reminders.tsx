import React, { useEffect, useState } from 'react';
import { db, Reminder } from '../lib/db';
import { Plus, Trash2, CheckCircle, Circle, Calendar, Bell, Tag, Clock, X, Search, ChevronRight, Edit2 } from 'lucide-react';
import { cn, formatDate } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const CATEGORIES = ['General', 'Payment', 'Stock', 'Customer', 'Meeting', 'Personal'];

export default function Reminders() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [search, setSearch] = useState('');

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('10:00');
  const [category, setCategory] = useState('General');

  useEffect(() => {
    loadReminders();
  }, []);

  const loadReminders = async () => {
    const data = await db.getReminders();
    setReminders(data.filter(r => !r.isDeleted));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const reminderData = {
      title,
      description,
      dateTime: `${date}T${time}`,
      category,
      isCompleted: editingReminder ? editingReminder.isCompleted : false
    };

    if (editingReminder) {
      await db.updateReminder({ ...editingReminder, ...reminderData });
    } else {
      await db.addReminder(reminderData);
    }

    closeModal();
    loadReminders();
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingReminder(null);
    setTitle('');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
    setTime('10:00');
    setCategory('General');
  };

  const openEdit = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setTitle(reminder.title);
    setDescription(reminder.description);
    const [d, t] = reminder.dateTime.split('T');
    setDate(d);
    setTime(t);
    setCategory(reminder.category);
    setIsModalOpen(true);
  };

  const toggleComplete = async (reminder: Reminder) => {
    await db.updateReminder({ ...reminder, isCompleted: !reminder.isCompleted });
    loadReminders();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Move this reminder to Recycle Bin?')) return;
    await db.deleteReminder(id);
    loadReminders();
  };

  const filteredReminders = reminders
    .filter(r => {
      const matchesSearch = String(r.title || "").toLowerCase().includes(search.toLowerCase()) || 
                           String(r.description || "").toLowerCase().includes(search.toLowerCase());
      const matchesTab = activeTab === 'completed' ? r.isCompleted : !r.isCompleted;
      return matchesSearch && matchesTab;
    })
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Bell className="text-[#2a9df4]" size={32} />
            Reminders
          </h2>
          <p className="text-gray-500 mt-1 font-medium">Manage your tasks and schedules</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-[#2a9df4] text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
        >
          <Plus size={20} /> Add Task
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-xl w-full md:w-auto">
          <button
            onClick={() => setActiveTab('active')}
            className={cn(
              "flex-1 md:w-32 py-2 px-4 text-sm font-bold rounded-lg transition-all",
              activeTab === 'active' 
                ? "bg-white dark:bg-gray-800 text-[#2a9df4] shadow-sm" 
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
            )}
          >
            Active
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={cn(
              "flex-1 md:w-32 py-2 px-4 text-sm font-bold rounded-lg transition-all",
              activeTab === 'completed' 
                ? "bg-white dark:bg-gray-800 text-[#2a9df4] shadow-sm" 
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
            )}
          >
            Completed
          </button>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search reminders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-[#2a9df4] outline-none transition-all dark:text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredReminders.map((reminder) => {
            const isToday = reminder.dateTime.split('T')[0] === todayStr;
            const isOverdue = !reminder.isCompleted && new Date(reminder.dateTime) < new Date();
            
            return (
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={reminder.id}
                className={cn(
                  "bg-white dark:bg-gray-800 p-5 rounded-2xl border transition-all hover:shadow-[0_10px_25px_rgba(0,0,0,0.1)] hover:-translate-y-1 hover:border-[#2a9df4]/50 active:scale-[0.97] active:translate-y-0 active:shadow-[0_2px_5px_rgba(0,0,0,0.15)] duration-300 group flex items-start gap-4",
                  isToday && !reminder.isCompleted ? "border-red-200 bg-red-50/30 dark:bg-red-900/10" : "border-gray-100 dark:border-gray-700"
                )}
              >
                <button
                  onClick={() => toggleComplete(reminder)}
                  className={cn(
                    "mt-1 p-1 rounded-full transition-colors",
                    reminder.isCompleted ? "text-green-500" : "text-gray-300 hover:text-[#2a9df4]"
                  )}
                >
                  {reminder.isCompleted ? <CheckCircle size={24} /> : <Circle size={24} />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <h4 className={cn(
                      "text-lg font-bold truncate",
                      reminder.isCompleted ? "text-gray-400 line-through" : "text-gray-900 dark:text-white"
                    )}>
                      {reminder.title}
                    </h4>
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap",
                      reminder.category === 'Payment' ? "bg-green-100 text-green-600" :
                      reminder.category === 'Stock' ? "bg-amber-100 text-amber-600" :
                      "bg-blue-100 text-blue-600"
                    )}>
                      {reminder.category}
                    </span>
                  </div>
                  
                  {reminder.description && (
                    <p className={cn(
                      "text-sm mt-1 mb-3 line-clamp-2",
                      reminder.isCompleted ? "text-gray-300" : "text-gray-500 dark:text-gray-400"
                    )}>
                      {reminder.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-gray-400">
                    <span className={cn(
                      "flex items-center gap-1",
                      isToday && !reminder.isCompleted ? "text-red-500" : ""
                    )}>
                      <Calendar size={14} />
                      {formatDate(reminder.dateTime.split('T')[0])}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={14} />
                      {reminder.dateTime.split('T')[1]}
                    </span>
                    {isToday && !reminder.isCompleted && (
                      <span className="bg-red-500 text-white px-2 py-0.5 rounded animate-pulse">DUE TODAY</span>
                    )}
                    {isOverdue && (
                      <span className="text-red-600">OVERDUE</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(reminder)}
                    className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(reminder.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredReminders.length === 0 && (
          <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-100 dark:border-gray-700">
            <Calendar className="mx-auto text-gray-200 mb-4" size={64} />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">No reminders found</h3>
            <p className="text-gray-500">Your task list is empty. Click "Add Task" to get started.</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingReminder ? 'Edit Task' : 'Add New Task'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Title</label>
                <input
                  autoFocus
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What needs to be done?"
                  className="w-full px-4 py-3 rounded-xl border border-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-[#2a9df4] outline-none transition-all font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add some details (optional)..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-[#2a9df4] outline-none transition-all font-medium resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-[#2a9df4] outline-none transition-all font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Time</label>
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-[#2a9df4] outline-none transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Category</label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                        category === cat
                          ? "bg-[#2a9df4] text-white border-[#2a9df4]"
                          : "bg-gray-50 dark:bg-gray-900 text-gray-500 border-gray-100 dark:border-gray-700 hover:border-[#2a9df4]/30"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-4 bg-[#2a9df4] text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                >
                  {editingReminder ? 'Update Changes' : 'Create Reminder'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
