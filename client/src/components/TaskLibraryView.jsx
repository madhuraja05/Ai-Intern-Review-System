import React, { useState } from 'react';

export default function TaskLibraryView({ tasks, onRefreshTasks }) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedTaskPreview, setSelectedTaskPreview] = useState(null);

  // New task form state
  const [taskForm, setTaskForm] = useState({
    id: '',
    module: '',
    title: '',
    description: '',
    requirements: '',
    deliverables: '',
    acceptance_criteria: '',
    sequence_order: tasks.length + 1,
    estimated_duration: '2 Days',
    reference_docs: ''
  });

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskForm)
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error);
        return;
      }
      setIsAddModalOpen(false);
      setTaskForm({
        id: '',
        module: '',
        title: '',
        description: '',
        requirements: '',
        deliverables: '',
        acceptance_criteria: '',
        sequence_order: tasks.length + 1,
        estimated_duration: '2 Days',
        reference_docs: ''
      });
      onRefreshTasks();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingTask) return;
    try {
      const res = await fetch(`/api/tasks/${editingTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTask)
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error);
        return;
      }
      setEditingTask(null);
      onRefreshTasks();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="panel">
        <div className="panel-header" style={{ flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h2 className="panel-title">📚 Official Company Task Library</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>
              Curated engineering tasks sequenced by difficulty. The AI evaluator validates submissions strictly against these company requirements.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
            ➕ Add Company Task
          </button>
        </div>

        {/* Tasks Table */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Seq #</th>
                <th>Task ID</th>
                <th>Module</th>
                <th>Task Title</th>
                <th>Estimated Time</th>
                <th>Requirements Checklist</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <tr key={task.id}>
                  <td>
                    <span style={{ fontWeight: 800, color: 'var(--primary)' }}>#{task.sequence_order}</span>
                  </td>
                  <td><code>{task.id}</code></td>
                  <td>
                    <span className="badge badge-neutral">{task.module}</span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{task.title}</td>
                  <td style={{ fontSize: '0.85rem' }}>{task.estimated_duration}</td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSelectedTaskPreview(task)}
                    >
                      View {task.requirements?.length || 0} Criteria
                    </button>
                  </td>
                  <td>
                    <span className={`badge ${task.is_active ? 'badge-success' : 'badge-neutral'}`}>
                      {task.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setEditingTask({
                        ...task,
                        requirements: Array.isArray(task.requirements) ? task.requirements.join('\n') : task.requirements
                      })}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Task Requirements Preview Modal */}
      {selectedTaskPreview && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3 className="panel-title">{selectedTaskPreview.id}: {selectedTaskPreview.title}</h3>
                <span className="badge badge-neutral">{selectedTaskPreview.module}</span>
              </div>
              <button className="modal-close" onClick={() => setSelectedTaskPreview(null)}>×</button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ fontSize: '0.88rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Description</h4>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{selectedTaskPreview.description}</p>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ fontSize: '0.88rem', color: 'var(--text-sub)', marginBottom: '8px' }}>Official Mandatory Requirements Checklist</h4>
              <ul style={{ paddingLeft: '20px', fontSize: '0.9rem', lineHeight: '1.7' }}>
                {selectedTaskPreview.requirements?.map((req, idx) => (
                  <li key={idx} style={{ marginBottom: '4px' }}>{req}</li>
                ))}
              </ul>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ fontSize: '0.88rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Acceptance Criteria</h4>
              <div className="code-box">{selectedTaskPreview.acceptance_criteria}</div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ fontSize: '0.88rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Expected Deliverables</h4>
              <p style={{ fontSize: '0.85rem' }}>{selectedTaskPreview.deliverables}</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedTaskPreview(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '750px' }}>
            <div className="modal-header">
              <h3 className="panel-title">➕ Add Official Company Task</h3>
              <button className="modal-close" onClick={() => setIsAddModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Task ID</label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder="e.g. TASK-106"
                    value={taskForm.id}
                    onChange={(e) => setTaskForm({ ...taskForm, id: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Module / Category</label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder="e.g. Microservices & Message Queues"
                    value={taskForm.module}
                    onChange={(e) => setTaskForm({ ...taskForm, module: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Task Title</label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="e.g. Event-Driven Messaging with RabbitMQ"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Description</label>
                <textarea
                  required
                  className="textarea"
                  style={{ minHeight: '70px' }}
                  placeholder="Detailed description of what the intern will build..."
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>
                  Mandatory Requirements (One per line)
                </label>
                <textarea
                  required
                  className="textarea"
                  style={{ minHeight: '90px' }}
                  placeholder="Setup RabbitMQ publisher endpoint&#10;Consume messages with error retry logic&#10;Include unit test verifying dead-letter queue"
                  value={taskForm.requirements}
                  onChange={(e) => setTaskForm({ ...taskForm, requirements: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Acceptance Criteria</label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder="e.g. All unit tests pass with zero message loss"
                    value={taskForm.acceptance_criteria}
                    onChange={(e) => setTaskForm({ ...taskForm, acceptance_criteria: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Estimated Duration</label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder="e.g. 2 Days"
                    value={taskForm.estimated_duration}
                    onChange={(e) => setTaskForm({ ...taskForm, estimated_duration: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save to Task Library</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '750px' }}>
            <div className="modal-header">
              <h3 className="panel-title">✏️ Edit Task: {editingTask.id}</h3>
              <button className="modal-close" onClick={() => setEditingTask(null)}>×</button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Module</label>
                  <input
                    type="text"
                    className="input"
                    value={editingTask.module}
                    onChange={(e) => setEditingTask({ ...editingTask, module: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Sequence Order</label>
                  <input
                    type="number"
                    className="input"
                    value={editingTask.sequence_order}
                    onChange={(e) => setEditingTask({ ...editingTask, sequence_order: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Title</label>
                <input
                  type="text"
                  className="input"
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Description</label>
                <textarea
                  className="textarea"
                  style={{ minHeight: '70px' }}
                  value={editingTask.description}
                  onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Requirements (One per line)</label>
                <textarea
                  className="textarea"
                  style={{ minHeight: '90px' }}
                  value={editingTask.requirements}
                  onChange={(e) => setEditingTask({ ...editingTask, requirements: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingTask(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
