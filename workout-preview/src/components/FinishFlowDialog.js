import React from 'react';
import { ActionDialog } from './UI';

export function FinishFlowDialog({ open, onClose, onUpdate, onSaveAsNew, onDiscard }) {
    if (!open) return null;
    return (
        <ActionDialog
            title="Save Template Changes"
            message="You've made structural changes to this workout. How would you like to save the template?"
            onCancel={onClose}
            buttons={[
                { text: 'Update', onClick: onUpdate, className: 'bg-indigo-600 hover:bg-indigo-700' },
                { text: 'Save as New', onClick: onSaveAsNew, className: 'bg-blue-600 hover:bg-blue-700' },
                { text: 'Discard', onClick: onDiscard, className: 'bg-red-600 hover:bg-red-700' },
            ]}
        />
    );
}


