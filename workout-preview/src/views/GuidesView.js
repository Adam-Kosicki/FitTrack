import React from 'react';
import { BookOpenIcon } from '../components/Icons';

export function GuidesView({ navigate }) {
    return (
        <div className="p-4 md:p-6 text-white">
            <div className="flex items-center mb-6">
                <BookOpenIcon className="h-8 w-8 text-indigo-400" />
                <h1 className="text-3xl font-bold ml-3">Guides</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <h2 className="text-xl font-semibold">Jake Tuura — Jumper's Knee</h2>
                    <p className="text-gray-400 mt-1 text-sm">Evidence-based patellar tendinopathy protocol with overview, pain log, and progressive stages.</p>
                    <button onClick={() => navigate('jumpersKnee')} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded">
                        Open Guide
                    </button>
                </div>

                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <h2 className="text-xl font-semibold">Ankle Recovery</h2>
                    <p className="text-gray-400 mt-1 text-sm">A structured approach for ankle sprain rehab and return to activity.</p>
                    <button onClick={() => navigate('ankleRecovery')} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded">
                        Open Guide
                    </button>
                </div>

                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <h2 className="text-xl font-semibold">Posture</h2>
                    <p className="text-gray-400 mt-1 text-sm">Foundational tips and routines to improve posture and reduce discomfort.</p>
                    <button onClick={() => navigate('posture')} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded">
                        Open Guide
                    </button>
                </div>
            </div>

            <div className="mt-8">
                <div className="inline-block bg-gray-800 text-gray-200 text-sm rounded-full px-4 py-2 border border-gray-700">
                    This section is a work in progress. Community-created guides will be supported in the future so anyone can create and share guides like "Jake Tuura — Jumper's Knee". Guide creator coming soon.
                </div>
            </div>
        </div>
    );
}


