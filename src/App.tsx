import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

// Página de exemplo do starter — mostra alguns componentes shadcn já tematizados pelos design tokens do
// Hive (design/tokens.json). O DevB substitui isto pelo app real, COMPONDO com src/components/ui (não recria).
export default function App() {
  const [dark, setDark] = useState(false);
  const toggle = (v: boolean) => {
    setDark(v);
    document.documentElement.classList.toggle("dark", v);
  };
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-primary" />
            <span className="text-lg font-semibold">Hive Starter</span>
            <Badge variant="secondary">shadcn/ui</Badge>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{dark ? "Escuro" : "Claro"}</span>
            <Switch checked={dark} onCheckedChange={toggle} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
        <section className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Componentes prontos, tema do Hive</h1>
          <p className="max-w-2xl text-muted-foreground">
            Botões, cards, inputs, tabs e mais — já tematizados pelos design tokens (<code>design/tokens.json</code>).
            Componha com <code>src/components/ui</code>; não recrie primitivos.
          </p>
        </section>

        <section className="flex flex-wrap gap-3">
          <Button>Ação primária</Button>
          <Button variant="secondary">Secundário</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="destructive">Excluir</Button>
          <Button variant="ghost">Ghost</Button>
        </section>

        <Separator />

        <section className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Entrar</CardTitle>
              <CardDescription>Card + inputs com o tema atual.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" placeholder="voce@exemplo.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="senha">Senha</Label>
                <Input id="senha" type="password" placeholder="senha secreta" />
              </div>
              <Button className="w-full">Entrar</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Abas</CardTitle>
              <CardDescription>Tabs, avatar e badges.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="visao">
                <TabsList>
                  <TabsTrigger value="visao">Visão</TabsTrigger>
                  <TabsTrigger value="time">Time</TabsTrigger>
                </TabsList>
                <TabsContent value="visao" className="pt-4 text-sm text-muted-foreground">
                  Tudo aqui herda as cores, o raio e a fonte dos tokens.
                </TabsContent>
                <TabsContent value="time" className="flex items-center gap-3 pt-4">
                  <Avatar>
                    <AvatarFallback>QB</AvatarFallback>
                  </Avatar>
                  <div className="text-sm">
                    <div className="font-medium">QueenB</div>
                    <div className="text-muted-foreground">Orquestradora</div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
