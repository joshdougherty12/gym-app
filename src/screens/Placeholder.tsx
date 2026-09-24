import { Card, Screen } from '../components/ui'

export function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <Screen title={title}>
      <Card>
        <p className="text-muted">{text}</p>
      </Card>
    </Screen>
  )
}
