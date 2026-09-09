import Header from '../../components/employer/Header'
import Sidebar from '../../components/employer/Sidebar'
import { Card, Badge, ProgressBar, SlotBox, Button, EmptyState } from '../../components/shared'

function Section({ title, children }) {
  return (
    <section className="mb-10">
      <h2 className="text-[11px] uppercase tracking-widelabel text-slate font-bold mb-3">
        {title}
      </h2>
      {children}
    </section>
  )
}

function StyleGuide() {
  return (
    <div className="min-h-screen bg-paper">
      <Header activeLink="Dashboard" />

      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-ink mb-1">Style Guide</h1>
        <p className="text-slate mb-8">Design tokens and shared components for the skillbridge design system.</p>

        <Section title="Colors">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
            {[
              ['ink', '#1c2534'],
              ['brass', '#c8933a'],
              ['paper', '#e7dfce'],
              ['card', '#f6f2e7'],
              ['slate', '#7c8494'],
              ['success', '#3f7a52'],
            ].map(([name, hex]) => (
              <div key={name} className="text-center">
                <div
                  className="w-full h-16 rounded-xl border border-slate/20 mb-1"
                  style={{ backgroundColor: hex }}
                />
                <div className="text-xs font-bold text-ink">{name}</div>
                <div className="text-[10px] text-slate">{hex}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Typography">
          <Card>
            <h1 className="text-3xl font-bold text-ink mb-2">Heading 1 / Bold</h1>
            <h2 className="text-xl font-bold text-ink mb-2">Heading 2 / Bold</h2>
            <p className="text-sm text-ink mb-2">Body text in the default system font stack.</p>
            <span className="text-[10px] uppercase tracking-widelabel text-slate font-bold">
              Field / Section Label
            </span>
          </Card>
        </Section>

        <Section title="Card">
          <Card>
            <p className="text-sm text-ink">
              This is a Card — rounded-xl, card background, soft shadow. It wraps every screen
              section.
            </p>
          </Card>
        </Section>

        <Section title="Badge">
          <Card>
            <div className="flex flex-wrap items-center gap-4">
              <Badge variant="brass">Guaranteed Match</Badge>
              <Badge variant="success">Passed</Badge>
              <Badge variant="slate">Pending</Badge>
              <Badge variant="flag" tooltip="Unusual answer timing detected during assessment.">
                Integrity Flag
              </Badge>
            </div>
          </Card>
        </Section>

        <Section title="ProgressBar">
          <Card>
            <div className="flex flex-col gap-6">
              <ProgressBar label="React Proficiency" value={82} max={100} showValue />
              <ProgressBar label="Slot Fill Rate" value={3} max={5} showValue />
              <ProgressBar label="Communication Skills" value={45} max={100} showValue />
            </div>
          </Card>
        </Section>

        <Section title="SlotBox">
          <div className="flex flex-wrap gap-4">
            <SlotBox filled={3} total={5} />
            <SlotBox filled={0} total={10} label="Open Roles" />
            <SlotBox filled={12} total={12} label="Interviews Booked" />
          </div>
        </Section>

        <Section title="Button">
          <Card>
            <div className="flex flex-wrap items-center gap-4">
              <Button variant="primary">Primary Action</Button>
              <Button variant="default">Secondary Action</Button>
              <Button variant="dark">Dark Action</Button>
            </div>
          </Card>
        </Section>

        <Section title="Header (dark navy top bar)">
          <div className="rounded-xl overflow-hidden border border-slate/20">
            <Header activeLink="Jobs" />
          </div>
        </Section>

        <Section title="Sidebar (dark navy vertical nav)">
          <div className="rounded-xl overflow-hidden border border-slate/20 inline-block">
            <Sidebar activeLink="Jobs" />
          </div>
        </Section>

        <Section title="EmptyState">
          <Card>
            <EmptyState
              title="No jobs yet"
              message="Create your first job to start building a candidate pipeline."
              actionLabel="+ Create job"
              actionTo="/employer/jobs/new"
            />
          </Card>
        </Section>
      </div>
    </div>
  )
}

export default StyleGuide
