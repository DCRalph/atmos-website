"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  BarChart3,
  Calendar,
  Users,
  Music,
  TrendingUp,
  Activity,
  ArrowRight,
  Clock,
  Star
} from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="min-h-dvh bg-background p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Welcome to your Atmos platform dashboard
            </p>
          </div>
          <Button>
            View Analytics
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Upcoming Gigs</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600 dark:text-green-400">+3</span> from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Content</CardTitle>
              <Music className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">48</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600 dark:text-green-400">+12%</span> from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,234</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600 dark:text-green-400">+18%</span> from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Engagement</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">89%</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600 dark:text-green-400">+5%</span> from last month
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          {/* Recent Activity */}
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Latest updates and events from your platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  {
                    title: "New gig added",
                    description: "Wellington Warehouse Party",
                    time: "2 hours ago",
                    type: "gig"
                  },
                  {
                    title: "Content published",
                    description: "New mix uploaded",
                    time: "5 hours ago",
                    type: "content"
                  },
                  {
                    title: "Newsletter sent",
                    description: "Monthly update to subscribers",
                    time: "1 day ago",
                    type: "newsletter"
                  },
                  {
                    title: "New crew member",
                    description: "DJ added to roster",
                    time: "2 days ago",
                    type: "crew"
                  },
                ].map((activity, idx) => (
                  <div key={idx} className="flex items-start gap-4 border-b border-border pb-4 last:border-0 last:pb-0">
                    <div className="rounded-full bg-primary/10 p-2">
                      {activity.type === "gig" && <Calendar className="h-4 w-4 text-primary" />}
                      {activity.type === "content" && <Music className="h-4 w-4 text-primary" />}
                      {activity.type === "newsletter" && <Activity className="h-4 w-4 text-primary" />}
                      {activity.type === "crew" && <Users className="h-4 w-4 text-primary" />}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">{activity.title}</p>
                      <p className="text-sm text-muted-foreground">{activity.description}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {activity.time}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
              <CardDescription>
                Overview of your platform performance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">This Month</span>
                  <Badge variant="secondary">Active</Badge>
                </div>
                <div className="h-2 w-full rounded-full bg-secondary">
                  <div className="h-2 w-3/4 rounded-full bg-primary" />
                </div>
                <p className="text-xs text-muted-foreground">75% of monthly goal</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Content Views</span>
                  <Badge variant="secondary">+24%</Badge>
                </div>
                <div className="h-2 w-full rounded-full bg-secondary">
                  <div className="h-2 w-full rounded-full bg-primary" />
                </div>
                <p className="text-xs text-muted-foreground">12,345 total views</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Subscriber Growth</span>
                  <Badge variant="secondary">+8%</Badge>
                </div>
                <div className="h-2 w-full rounded-full bg-secondary">
                  <div className="h-2 w-1/2 rounded-full bg-primary" />
                </div>
                <p className="text-xs text-muted-foreground">567 new subscribers</p>
              </div>

              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm font-medium">Platform Rating</span>
                  </div>
                  <span className="text-2xl font-bold">4.8</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Based on 234 reviews</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Analytics
              </CardTitle>
              <CardDescription>
                View detailed platform analytics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Track your platform performance with comprehensive analytics and insights.
              </p>
              <Button variant="outline" className="w-full">
                View Analytics
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Upcoming Events
              </CardTitle>
              <CardDescription>
                Manage your upcoming gigs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                You have 3 gigs scheduled in the next 30 days.
              </p>
              <Button variant="outline" className="w-full">
                View Gigs
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Community
              </CardTitle>
              <CardDescription>
                Engage with your community
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Connect with fans and manage your community interactions.
              </p>
              <Button variant="outline" className="w-full">
                View Community
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
