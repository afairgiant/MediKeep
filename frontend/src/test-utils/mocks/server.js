import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Setup MSW server with our handlers
export const server = setupServer(...handlers);
