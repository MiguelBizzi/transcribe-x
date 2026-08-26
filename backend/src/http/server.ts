import { fastify } from 'fastify'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUI from '@fastify/swagger-ui'
import fastifyJwt from '@fastify/jwt'
import fastifyCors from '@fastify/cors'
import fastifyMultipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import path from 'path'
import {
    jsonSchemaTransform,
    serializerCompiler,
    validatorCompiler,
    ZodTypeProvider,
} from '@fastify/type-provider-zod'
import { errorHandler } from './error-handler'
import { env } from '@/lib/env'
import auth from './middlewares/auth'
import { authRoutes } from './routes/auth'
import { recentActivityRoutes } from './routes/recent-activity'
import { transcriptionRoutes } from './routes/transcriptions'
import { exportRoutes } from './routes/exports'
import { cleanupJobs } from '@/jobs/cleanup-jobs'

const app = fastify().withTypeProvider<ZodTypeProvider>()

app.setSerializerCompiler(serializerCompiler)
app.setValidatorCompiler(validatorCompiler)
app.setErrorHandler(errorHandler)

app.register(fastifySwagger, {
    openapi: {
        info: {
            title: 'TranscribeX API',
            description: 'TranscribeX API documentation',
            version: '1.0.0',
        },
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
    },
    transform: jsonSchemaTransform,
})

app.register(fastifySwaggerUI, {
    routePrefix: '/docs',
})

app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
})

app.register(fastifyCors, {
    origin: [
        env.FRONTEND_URL,
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
})

app.register(fastifyMultipart, {
    attachFieldsToBody: true,
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
})

app.register(fastifyStatic, {
    root: path.join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
    decorateReply: false,
})

app.register(auth)

app.register(authRoutes)
app.register(recentActivityRoutes)
app.register(transcriptionRoutes)
app.register(exportRoutes)

app.listen({ port: env.SERVER_PORT }).then(() => {
    console.log('Server is running on port', env.SERVER_PORT)

    cleanupJobs.start()
})
