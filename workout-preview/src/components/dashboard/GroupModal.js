import React from 'react';
import { Modal, TextArea } from '../UI';

export function GroupModal({
    open,
    onClose,
    group,
    groupOverview,
    exportText,
    editGroupName,
    editGroupDescription,
    editAiText,
    editAiSummaryText,
    groupOptionsTab,
    setGroupOptionsTab,
    setEditGroupName,
    setEditGroupDescription,
    setEditAiText,
    setEditAiSummaryText,
    onRegenerateAi,
    onGenerateSummary,
    generating,
    isGeneratingSummary,
    onSave
}) {
    if (!open) return null;
    return (
        <Modal title="Group" onClose={onClose} maxWidthClass="max-w-3xl">
            <div className="space-y-4">
                <div className="flex gap-2 border-b border-gray-700 pb-2">
                    <button
                        className={`px-3 py-1 rounded ${groupOptionsTab === 'overview' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:text-white'}`}
                        onClick={() => setGroupOptionsTab('overview')}
                    >
                        Overview
                    </button>
                    <button
                        className={`px-3 py-1 rounded ${groupOptionsTab === 'options' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:text-white'}`}
                        onClick={() => setGroupOptionsTab('options')}
                    >
                        Options
                    </button>
                </div>

                {groupOptionsTab === 'overview' && (
                    <div className="space-y-4">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="text-sm text-gray-400">Group</div>
                                <div className="text-lg font-semibold text-white">{(group?.name || '').trim() || 'Untitled Group'}</div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <div className="bg-gray-800 rounded p-3">
                                <div className="text-xs text-gray-400">Workouts</div>
                                <div className="text-xl font-bold">{groupOverview?.workoutsCount || 0}</div>
                            </div>
                            <div className="bg-gray-800 rounded p-3">
                                <div className="text-xs text-gray-400">Exercises</div>
                                <div className="text-xl font-bold">{groupOverview?.totalExercises || 0}</div>
                            </div>
                            <div className="bg-gray-800 rounded p-3">
                                <div className="text-xs text-gray-400">Sets</div>
                                <div className="text-xl font-bold">{groupOverview?.totalSets || 0}</div>
                            </div>
                        </div>
                        <div className="bg-gray-800 rounded p-4">
                            <div className="text-xs uppercase tracking-wide text-gray-500">AI description</div>
                            <p className="text-gray-300 text-sm mt-1 whitespace-pre-wrap">{(group?.aiDescription || '').trim() || 'No AI description yet.'}</p>
                        </div>
                        <div>
                            <div className="text-sm text-gray-400 mb-2">Muscle group breakdown</div>
                            <div className="space-y-2">
                                {(groupOverview?.muscleGroupsSorted || []).map(row => (
                                    <div key={row.muscleGroup} className="flex items-center justify-between bg-gray-800 rounded p-2">
                                        <div className="text-gray-200">{row.muscleGroup === 'Unknown' ? 'Other' : row.muscleGroup}</div>
                                        <div className="text-gray-400 text-sm">{row.sets} sets<span className="mx-2">•</span>{row.exercises} exercises</div>
                                    </div>
                                ))}
                                {(!groupOverview || (groupOverview.muscleGroupsSorted || []).length === 0) && (
                                    <div className="text-gray-500 text-sm">No muscle data available.</div>
                                )}
                            </div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-400 mb-1">Special methods detected</div>
                            <div className="flex flex-wrap gap-2">
                                {groupOverview && (groupOverview.special?.HSR > 0 || groupOverview.special?.plyometrics > 0 || groupOverview.special?.unilateral > 0) ? (
                                    <>
                                        {groupOverview.special.HSR > 0 && (<span className="bg-gray-800 text-gray-200 text-xs px-2 py-1 rounded">HSR</span>)}
                                        {groupOverview.special.plyometrics > 0 && (<span className="bg-gray-800 text-gray-200 text-xs px-2 py-1 rounded">Plyometrics</span>)}
                                        {groupOverview.special.unilateral > 0 && (<span className="bg-gray-800 text-gray-200 text-xs px-2 py-1 rounded">Unilateral</span>)}
                                    </>
                                ) : (
                                    <span className="text-gray-500 text-sm">None</span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {groupOptionsTab === 'options' && (
                    <>
                        <div>
                            <label className="block text-sm text-gray-300 mb-1">Group Name</label>
                            <input
                                type="text"
                                value={editGroupName}
                                onChange={(e) => setEditGroupName(e.target.value)}
                                className="w-full bg-gray-700 p-2 rounded border border-gray-600 focus:ring-indigo-500 focus:border-indigo-500 text-white"
                                placeholder="e.g., Push Day Variations"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-300 mb-1">Description</label>
                            <TextArea
                                value={editGroupDescription}
                                onChange={(e) => setEditGroupDescription(e.target.value)}
                                rows={4}
                                placeholder="Optional notes about this grouping..."
                            />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-sm text-gray-300">AI Description</label>
                                <button
                                    onClick={onRegenerateAi}
                                    className={`text-black font-bold py-1 px-3 rounded text-sm ${generating ? 'bg-yellow-700' : 'bg-yellow-500 hover:bg-yellow-400'}`}
                                    disabled={generating}
                                >
                                    {generating ? 'AI…' : 'Regenerate with AI'}
                                </button>
                            </div>
                            <TextArea
                                value={editAiText}
                                onChange={(e) => setEditAiText(e.target.value)}
                                rows={4}
                                placeholder="Short, generalized summary for this group..."
                            />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-sm text-gray-300">AI Summary</label>
                                <button
                                    onClick={onGenerateSummary}
                                    className={`text-black font-bold py-1 px-3 rounded text-sm ${isGeneratingSummary ? 'bg-yellow-700' : 'bg-yellow-500 hover:bg-yellow-400'}`}
                                    disabled={isGeneratingSummary}
                                >
                                    {isGeneratingSummary ? 'AI…' : 'Generate from description'}
                                </button>
                            </div>
                            <TextArea
                                value={editAiSummaryText}
                                onChange={(e) => setEditAiSummaryText(e.target.value)}
                                rows={3}
                                placeholder="1–2 sentence summary of the AI description..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-300 mb-1">Group Export (copy as text)</label>
                            <TextArea
                                value={exportText}
                                onChange={() => {}}
                                rows={6}
                                placeholder="Export text will appear here..."
                            />
                            <div className="mt-2 flex justify-end">
                                <button
                                    onClick={async () => { try { await navigator.clipboard.writeText(exportText); } catch {} }}
                                    className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
                                >
                                    Copy
                                </button>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={onClose} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">Cancel</button>
                            <button onClick={onSave} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded">Save</button>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
}


