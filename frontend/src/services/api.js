// Legacy API service file - now delegates to modular services
// This file is kept for backward compatibility
// New code should import from './api/index' or specific modules

import { apiService } from './api/index';

// Export the main API service for backward compatibility
export { apiService };
export default apiService;
