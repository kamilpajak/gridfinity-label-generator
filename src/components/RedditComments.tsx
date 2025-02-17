import type {PropFunction} from '@builder.io/qwik';
import {component$} from '@builder.io/qwik';
import {ChatBubbleIcon} from './icons';

interface Props {
    showComments: boolean;
    onToggle$: PropFunction<() => void>;
}

export const RedditComments = component$<Props>(({showComments, onToggle$}) => (
    <div class="bg-white rounded-xl shadow-lg overflow-hidden">
        <div class="p-8 space-y-6">
            {/* Header with enhanced styling */}
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <ChatBubbleIcon class="w-5 h-5 text-gray-700"/>
                    <h3 class="text-lg font-medium text-gray-900">Community Discussion</h3>
                </div>
                <button
                    onClick$={onToggle$}
                    class="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                    {showComments ? 'Hide Comments' : 'Show Comments'}
                </button>
            </div>

            {showComments ? (
                <div class="relative p-[1px] rounded-xl bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200">
                    <div
                        class="relative rounded-xl overflow-hidden bg-gradient-to-b from-white/40 to-white/20 backdrop-blur-[2px]">
                        <iframe
                            src="https://www.reddit.com/r/gridfinity/comments/1ip9r98/i_created_a_web_app_for_generating_gridfinity/embed"
                            class="w-full h-[600px]"
                            style={{border: 'none'}}
                            sandbox="allow-scripts allow-same-origin allow-popups"
                        />
                    </div>
                </div>
            ) : (
                <div class="flex items-center gap-4 p-6 bg-gray-50 rounded-xl border border-gray-200">
                    <div class="w-12 h-12 flex items-center justify-center bg-blue-100 rounded-lg">
                        <ChatBubbleIcon class="w-6 h-6 text-blue-600"/>
                    </div>
                    <div>
                        <h4 class="text-base font-medium text-gray-900 mb-1">Join the Discussion</h4>
                        <p class="text-sm text-gray-600">
                            Click "Show Comments" to view and participate in discussions about the Gridfinity Label
                            Generator on Reddit.
                        </p>
                    </div>
                </div>
            )}
        </div>
    </div>
));