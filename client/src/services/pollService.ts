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
 * Fetch a single poll by ID
 */
export const fetchPollById = async (pollId: string): Promise<Poll | null> => {
    // If not implemented as a dedicated endpoint, we could fetch all and find,
    // but ideally, we add GET /api/polls/:id if needed.
    // For now, let's assume it might be needed by some UI.
    try {
        return await callBackend(`/api/polls/${pollId}`);
    } catch (e) {
        return null;
    }
};

/**
 * Check if a user has already responded to a poll
 */
export const checkUserPollResponse = async (pollId: string, userId: string): Promise<boolean> => {
    const data = await callBackend(`/api/polls/check-response?pollId=${pollId}&userId=${userId}`);
    return data.has_responded;
};
