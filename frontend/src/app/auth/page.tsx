'use client'

import { Video } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { getGoogleAuthUrl } from '@/services/auth-service'
import { Separator } from '@/components/ui/separator'
import { GoogleIcon } from '@/components/svgs/google'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useAction } from 'next-safe-action/hooks'
import {
  loginAction,
  registerAction,
  loginSchema,
  registerSchema,
  type LoginForm,
  type RegisterForm,
} from './data'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function Auth() {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin')
  const [googleLoading, setGoogleLoading] = useState(false)
  const router = useRouter()

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  })

  const { execute: executeLogin, status: loginStatus } = useAction(
    loginAction,
    {
      onSuccess: (data) => {
        if (data.data.success) {
          toast.success(data.data.message)
          router.push('/dashboard')
        } else {
          loginForm.setError('password', {
            message: data.data.message,
          })
        }
      },
      onError: () => {
        loginForm.setError('password', {
          message: 'Ocorreu um erro ao fazer login. Tente novamente.',
        })
      },
    },
  )

  const { execute: executeRegister, status: registerStatus } = useAction(
    registerAction,
    {
      onSuccess: (data) => {
        if (data.data.success) {
          toast.success(`${data.data.message} Faça login para continuar`)
          setActiveTab('signin')
        } else {
          registerForm.setError('password', {
            message: data.data.message,
          })
        }
      },
      onError: () => {
        registerForm.setError('password', {
          message:
            'Ocorreu um erro ao criar a conta. Tente novamente.',
        })
      },
    },
  )

  function handleLogin(data: LoginForm) {
    executeLogin(data)
  }

  function handleRegister(data: RegisterForm) {
    executeRegister(data)
  }

  async function handleGoogleLogin() {
    try {
      setGoogleLoading(true)

      const { authUrl } = await getGoogleAuthUrl()
      window.location.href = authUrl
    } catch (err) {
      console.error('Google login failed:', err)
      setGoogleLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'signin') {
      loginForm.reset()
    } else {
      registerForm.reset()
    }
  }, [activeTab, loginForm, registerForm])

  const isLoginLoading = loginStatus === 'executing'
  const isRegisterLoading = registerStatus === 'executing'

  return (
    <div className="from-background to-background/80 flex min-h-screen items-center justify-center bg-gradient-to-br p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="from-primary to-secondary rounded-lg bg-linear-to-br p-2">
            <Video className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold">TranscribeX</span>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>Bem-vindo</CardTitle>
            <CardDescription>
              Entre na sua conta ou crie uma nova
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              defaultValue="signin"
              className="w-full"
              value={activeTab}
              onValueChange={(value) =>
                setActiveTab(value as 'signin' | 'signup')
              }
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Cadastrar</TabsTrigger>
              </TabsList>

              <div className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleLogin}
                  disabled={
                    googleLoading || isLoginLoading || isRegisterLoading
                  }
                >
                  {googleLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <GoogleIcon />
                  )}
                  Continuar com o Google
                </Button>
              </div>

              <div className="mt-6 flex items-center">
                <Separator className="flex-1" />
                <span className="text-muted-foreground px-3 text-xs">OU</span>
                <Separator className="flex-1" />
              </div>

              <TabsContent value="signin" className="mt-4">
                <Form {...loginForm}>
                  <form
                    onSubmit={loginForm.handleSubmit(handleLogin)}
                    className="space-y-4"
                  >
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-mail</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="seu@email.com"
                              type="email"
                              disabled={isLoginLoading}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Senha</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="••••••••"
                              type="password"
                              disabled={isLoginLoading}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoginLoading}
                    >
                      {isLoginLoading && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Entrar
                    </Button>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="signup" className="mt-4">
                <Form {...registerForm}>
                  <form
                    onSubmit={registerForm.handleSubmit(handleRegister)}
                    className="space-y-4"
                  >
                    <FormField
                      control={registerForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome completo</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Seu nome completo"
                              type="text"
                              disabled={isRegisterLoading}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-mail</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="seu@email.com"
                              type="email"
                              disabled={isRegisterLoading}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Senha</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="••••••••"
                              type="password"
                              disabled={isRegisterLoading}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isRegisterLoading}
                    >
                      {isRegisterLoading && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Criar conta
                    </Button>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>

            <div className="mt-6 text-center">
              <Link
                href="/"
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                ← Voltar à página inicial
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
