export default async function handler(req: any, res: any) {
    try {
        console.log('🌐 [api/index] Starting request handler...');
        const { default: app } = await import('../src/index.js');
        return app(req, res);
    } catch (error: any) {
        console.error('❌ [api/index] Critical initialization error:', error);
        console.error('❌ [api/index] Error code:', error.code);
        console.error('❌ [api/index] Error message:', error.message);
        res.status(500).json({
            error: 'CRITICAL_INITIALIZATION_ERROR',
            message: error.message,
            code: error.code
        });
    }
}
