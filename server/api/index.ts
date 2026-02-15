export default async function handler(req: any, res: any) {
    try {
        console.log('🌐 [api/index] Starting request handler...');
        console.log('📂 [api/index] Current directory:', process.cwd());

        // Attempt to list files for debugging if it fails
        const { default: app } = await import('../src/index.js');
        return app(req, res);
    } catch (error: any) {
        console.error('❌ [api/index] Critical initialization error:', error);

        // Try to provide more context in the response
        res.status(500).json({
            error: 'MODULE_NOT_FOUND_DEBUG',
            message: error.message,
            stack: error.stack,
            dir: process.cwd(),
            hint: "Check if ../src/index.js exists in the build output. Try clicking the log line in Vercel to see the FULL path of the missing module."
        });
    }
}
