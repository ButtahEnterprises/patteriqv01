"use client";

import * as React from "react";
import Button from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { Badge } from "../../components/ui/badge";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Tabs } from "../../components/ui/tabs";
import { Modal } from "../../components/ui/modal";

export default function ExamplesPage() {
  const [open, setOpen] = React.useState(false);

  return (
    <main className="container mx-auto max-w-6xl px-4 py-6 text-white">
      <h1 className="text-xl font-semibold">UI Primitives Examples</h1>
      <p className="mt-1 text-sm text-white/70">Accessible, Tailwind-styled components per our frontend guides.</p>

      <section className="mt-6 grid gap-6 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Buttons</CardTitle>
            <CardDescription>Variants and sizes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button loading>Loading</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
              <Button size="icon" aria-label="Icon button">★</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Form Inputs</CardTitle>
            <CardDescription>Labeled form controls</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" aria-label="Example form">
              <div>
                <label className="block text-xs text-white/80 mb-1" htmlFor="name">Name</label>
                <Input id="name" placeholder="Jane Doe" />
              </div>
              <div>
                <label className="block text-xs text-white/80 mb-1" htmlFor="role">Role</label>
                <Select id="role" defaultValue="manager">
                  <option value="manager">Manager</option>
                  <option value="analyst">Analyst</option>
                  <option value="rep">Field Rep</option>
                </Select>
              </div>
              <div>
                <label className="block text-xs text-white/80 mb-1" htmlFor="notes">Notes</label>
                <Textarea id="notes" placeholder="Add any comments here..." rows={4} />
              </div>
              <div className="flex justify-end">
                <Button type="submit">Submit</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Badges</CardTitle>
            <CardDescription>Semantic styles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge>Default</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge variant="outline">Outline</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Table</CardTitle>
            <CardDescription>Hover/focus rows and header scopes</CardDescription>
          </CardHeader>
          <CardContent>
            <Table role="table" aria-label="Example data table">
              <TableCaption>Top 3 stores by revenue</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Store</TableHead>
                  <TableHead scope="col">City</TableHead>
                  <TableHead scope="col">Revenue ($)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { store: "UL-101", city: "Austin", rev: "$42,120" },
                  { store: "UL-072", city: "Denver", rev: "$39,880" },
                  { store: "UL-215", city: "Miami", rev: "$37,150" },
                ].map((r) => (
                  <TableRow key={r.store} tabIndex={0} className="outline-none">
                    <TableCell className="font-medium text-white">{r.store}</TableCell>
                    <TableCell>{r.city}</TableCell>
                    <TableCell>{r.rev}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Tabs</CardTitle>
            <CardDescription>Keyboard navigable</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              tabs={[
                { value: "one", label: "One", content: <div className="text-white/80">Tab one content</div> },
                { value: "two", label: "Two", content: <div className="text-white/80">Tab two content</div> },
                { value: "three", label: "Three", content: <div className="text-white/80">Tab three content</div> },
              ]}
            />
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Modal</CardTitle>
            <CardDescription>Accessible dialog with overlay and Escape close</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setOpen(true)}>Open Modal</Button>
            <Modal
              open={open}
              onClose={() => setOpen(false)}
              title="Sample Modal"
              description="This is a simple, accessible modal dialog."
            >
              <p className="text-sm text-white/80">
                Use Escape or the Close button to dismiss. Clicking the backdrop also closes it.
              </p>
            </Modal>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
