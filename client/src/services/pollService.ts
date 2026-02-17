import { callBackend } from './backendService';
import { Poll, PollResponse } from '../types';

/**
 * Fetch all polls for an organization
 */
export const fetchPolls = async (organizationId: string): Promise<Poll[]> => {
    return await callBackend(`/api/polls?organizationId=${organizationId}`);
};

/**
 * Create a new poll
 */
export const addPoll = async (poll: Omit<Poll, 'id' | 'created_at'>): Promise<Poll> => {
    return await callBackend('/api/polls', 'POST', poll);
};

/**
 * Update an existing poll
 */
export const updatePoll = async (id: string, updates: Partial<Poll>): Promise<Poll> => {
    return await callBackend(`/api/polls/${id}`, 'PATCH', updates);
};

/**
 * Submit a response to a poll
 */
export const submitPollResponse = async (response: Omit<PollResponse, 'id' | 'created_at'>): Promise<PollResponse> => {
    return await callBackend('/api/polls/response', 'POST', response);
};

/**
 * Fetch all responses for a specific poll with user names
 */
export const fetchPollResults = async (pollId: string): Promise<PollResponse[]> => {
    return await callBackend(`/api/polls/${pollId}/results`);
};

/**
 * Fetch a single poll by ID (Not yet implemented on backend, but could be added if needed)
 * For now, we can filter from fetchPolls or just use it as a placeholder.
 */
export const fetchPollById = async (pollId: string): Promise<Poll | null> => {
    // Note: If we need a specific poll by ID, we can implement GET /api/polls/:id
    // But usually we fetch all for the org.
    const polls = await fetchPolls(''); // Placeholder
    return polls.find(p => p.id === pollId) || null;
};

/**
 * Check if a user has already responded to a poll
 */
export const checkUserPollResponse = async (pollId: string, userId: string): Promise<boolean> => {
    const data = await callBackend(`/api/polls/check-response?pollId=${pollId}&userId=${userId}`);
    return data.has_responded;
};
