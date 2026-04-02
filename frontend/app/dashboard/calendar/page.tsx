"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  format,
  addDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  parseISO,
} from "date-fns"
import { CalendarIcon, ChevronLeft, ChevronRight, Clock, Plus, Users, X } from "lucide-react"
import { useSidebar } from "@/components/sidebar-toggle"

// Sample events data
const EVENTS = [
  {
    id: 1,
    title: "Team Meeting",
    date: "2025-04-20T10:00:00",
    endDate: "2025-04-20T11:00:00",
    description: "Weekly team sync to discuss project progress",
    attendees: [
      { id: 1, name: "John Doe", avatar: "/placeholder-user.jpg", initials: "JD" },
      { id: 2, name: "Sarah Lee", avatar: "/placeholder-user.jpg", initials: "SL" },
    ],
    color: "blue",
  },
  // Other events...
]

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [view, setView] = useState("month") // month, week, day
  const [newEvent, setNewEvent] = useState({
    title: "",
    date: format(new Date(), "yyyy-MM-dd"),
    time: "10:00",
    endTime: "11:00",
    description: "",
    attendees: [] as { id: number; name: string }[],
    color: "blue",
  })
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { isOpen, toggleSidebar } = useSidebar()

  // Get days for the current month view
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Get events for the selected date
  const getEventsForDate = (date: Date) => {
    return EVENTS.filter((event) => {
      const eventDate = parseISO(event.date)
      return isSameDay(eventDate, date)
    })
  }

  // Get events for the current month
  const getEventsForDay = (day: Date) => {
    return EVENTS.filter((event) => {
      const eventDate = parseISO(event.date)
      return isSameDay(eventDate, day)
    })
  }

  // Handle month navigation
  const previousMonth = () => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev)
      newDate.setMonth(newDate.getMonth() - 1)
      return newDate
    })
  }

  const nextMonth = () => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev)
      newDate.setMonth(newDate.getMonth() + 1)
      return newDate
    })
  }

  // Handle new event creation
  const handleCreateEvent = () => {
    // In a real app, you would save the event to your database
    console.log("Creating event:", newEvent)
    setIsDialogOpen(false)
    // Reset form
    setNewEvent({
      title: "",
      date: format(new Date(), "yyyy-MM-dd"),
      time: "10:00",
      endTime: "11:00",
      description: "",
      attendees: [],
      color: "blue",
    })
  }

  // Get color class for event
  const getEventColorClass = (color: string) => {
    switch (color) {
      case "blue":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800"
      case "purple":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-purple-200 dark:border-purple-800"
      case "green":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-800"
      case "amber":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700"
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden" onClick={toggleSidebar} />
      )}

      {/* Calendar Header */}
      <div className="flex items-center justify-between p-4 md:p-6 border-b">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Calendar</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={previousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-medium min-w-[140px] text-center">{format(currentDate, "MMMM yyyy")}</h2>
            <Button variant="outline" size="sm" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={view} onValueChange={setView}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="View" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="day">Day</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Event</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create New Event</DialogTitle>
                <DialogDescription>Add a new event to your calendar. Click save when you're done.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Event Title</Label>
                  <Input
                    id="title"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    placeholder="Team Meeting"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="date">Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {newEvent.date}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={new Date(newEvent.date)}
                          onSelect={(date) => date && setNewEvent({ ...newEvent, date: format(date, "yyyy-MM-dd") })}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="time">Start Time</Label>
                    <Input
                      id="time"
                      type="time"
                      value={newEvent.time}
                      onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="endTime">End Time</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={newEvent.endTime}
                    onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="color">Event Color</Label>
                  <Select value={newEvent.color} onValueChange={(value) => setNewEvent({ ...newEvent, color: value })}>
                    <SelectTrigger id="color">
                      <SelectValue placeholder="Select color" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blue">Blue</SelectItem>
                      <SelectItem value="purple">Purple</SelectItem>
                      <SelectItem value="green">Green</SelectItem>
                      <SelectItem value="amber">Amber</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    placeholder="Event details..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Attendees</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Add attendees" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="john">John Doe</SelectItem>
                      <SelectItem value="sarah">Sarah Lee</SelectItem>
                      <SelectItem value="mike">Mike Thompson</SelectItem>
                      <SelectItem value="emily">Emily Chen</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {newEvent.attendees.map((attendee) => (
                      <div key={attendee.id} className="flex items-center gap-1 bg-secondary rounded-full px-2 py-1">
                        <span className="text-xs">{attendee.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 rounded-full"
                          onClick={() =>
                            setNewEvent({
                              ...newEvent,
                              attendees: newEvent.attendees.filter((a) => a.id !== attendee.id),
                            })
                          }
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateEvent}>Create Event</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {view === "month" && (
          <div className="grid grid-cols-7 gap-2">
            {/* Day headers */}
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="text-center font-medium text-sm py-2">
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {monthDays.map((day, i) => {
              const dayEvents = getEventsForDay(day)
              const isToday = isSameDay(day, new Date())
              const isSelected = selectedDate && isSameDay(day, selectedDate)

              return (
                <div
                  key={i}
                  className={`min-h-[120px] border rounded-md p-2 ${!isSameMonth(day, currentDate) ? "opacity-40" : ""
                    } ${isToday ? "border-primary" : ""} ${isSelected ? "bg-secondary/50" : ""}`}
                  onClick={() => setSelectedDate(day)}
                >
                  <div className="text-right mb-1">
                    <span
                      className={`inline-block w-6 h-6 rounded-full text-center text-sm ${isToday ? "bg-primary text-primary-foreground" : ""
                        }`}
                    >
                      {format(day, "d")}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        className={`text-xs p-1 rounded truncate border ${getEventColorClass(event.color)}`}
                      >
                        {format(parseISO(event.date), "HH:mm")} {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-muted-foreground text-center">+{dayEvents.length - 3} more</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {view === "day" && selectedDate && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">{format(selectedDate, "EEEE, MMMM d, yyyy")}</h3>
            <div className="space-y-4">
              {getEventsForDate(selectedDate).length > 0 ? (
                getEventsForDate(selectedDate).map((event) => (
                  <Card key={event.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{event.title}</h4>
                          <div className="flex items-center text-sm text-muted-foreground mt-1">
                            <Clock className="h-4 w-4 mr-1" />
                            {format(parseISO(event.date), "HH:mm")} - {format(parseISO(event.endDate), "HH:mm")}
                          </div>
                          <p className="text-sm mt-2">{event.description}</p>
                        </div>
                        <Button variant="ghost" size="icon">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {event.attendees && event.attendees.length > 0 && (
                        <div className="mt-4">
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Users className="h-4 w-4 mr-1" />
                            <span>{event.attendees.length} attendees</span>
                          </div>
                          <div className="flex mt-2 space-x-1">
                            {event.attendees.map((attendee) => (
                              <Avatar key={attendee.id} className="h-6 w-6">
                                <AvatarImage src={attendee.avatar || "/placeholder-user.jpg"} alt={attendee.name} />
                                <AvatarFallback>{attendee.initials}</AvatarFallback>
                              </Avatar>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">No events scheduled for this day</div>
              )}
            </div>
          </div>
        )}

        {view === "week" && (
          <div className="space-y-4">
            <div className="grid grid-cols-7 gap-2">
              {/* Day headers for the week */}
              {Array.from({ length: 7 }, (_, i) => {
                const day = addDays(selectedDate || new Date(), i - (selectedDate?.getDay() || 0))
                return (
                  <div
                    key={i}
                    className={`text-center p-2 ${isSameDay(day, new Date()) ? "bg-primary/10 rounded-md" : ""}`}
                  >
                    <div className="font-medium">{format(day, "EEE")}</div>
                    <div
                      className={`inline-block w-8 h-8 rounded-full text-center leading-8 mt-1 ${isSameDay(day, new Date()) ? "bg-primary text-primary-foreground" : ""
                        }`}
                    >
                      {format(day, "d")}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="grid grid-cols-7 gap-2 mt-2">
              {/* Events for each day of the week */}
              {Array.from({ length: 7 }, (_, i) => {
                const day = addDays(selectedDate || new Date(), i - (selectedDate?.getDay() || 0))
                const dayEvents = getEventsForDay(day)

                return (
                  <div key={i} className="min-h-[200px] border rounded-md p-2">
                    <div className="space-y-2">
                      {dayEvents.map((event) => (
                        <div key={event.id} className={`text-xs p-2 rounded border ${getEventColorClass(event.color)}`}>
                          <div className="font-medium">{event.title}</div>
                          <div>{format(parseISO(event.date), "HH:mm")}</div>
                        </div>
                      ))}
                      {dayEvents.length === 0 && (
                        <div className="text-xs text-muted-foreground text-center py-4">No events</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
