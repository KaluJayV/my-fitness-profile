import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MultiSelect } from "@/components/ui/multi-select"
import { Loader2, User, LogOut } from "lucide-react"
import { AppHeader } from "@/components/AppHeader"

const profileSchema = z.object({
  username: z.string().min(2, "Username must be at least 2 characters"),
  goal: z.string().optional(),
  experience: z.string().optional(),
  injuries: z.array(z.string()),
  equipment: z.array(z.string()),
})

type ProfileFormData = z.infer<typeof profileSchema>

const injuryOptions = [
  { label: "Lower Back", value: "lower_back" },
  { label: "Knee", value: "knee" },
  { label: "Shoulder", value: "shoulder" },
  { label: "Wrist", value: "wrist" },
  { label: "Ankle", value: "ankle" },
  { label: "Neck", value: "neck" },
  { label: "Hip", value: "hip" },
  { label: "Elbow", value: "elbow" },
]

const equipmentOptions = [
  { label: "Dumbbells", value: "db" },
  { label: "Barbell", value: "barbell" },
  { label: "Bench", value: "bench" },
  { label: "Resistance Bands", value: "bands" },
  { label: "Pull-up Bar", value: "pullup_bar" },
  { label: "Kettlebells", value: "kettlebells" },
  { label: "Cable Machine", value: "cable" },
  { label: "Smith Machine", value: "smith" },
  { label: "Leg Press", value: "leg_press" },
  { label: "Squat Rack", value: "squat_rack" },
]

export default function Profile() {
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const { toast } = useToast()
  const { signOut } = useAuth()

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: "",
      goal: "",
      experience: "",
      injuries: [],
      equipment: ["db", "barbell", "bench", "bands", "pullup_bar"],
    },
  })

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError) throw authError
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to access your profile",
          variant: "destructive",
        })
        return
      }

      setUser(user)

      const { data: profile, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .maybeSingle()

      if (error) throw error

      if (profile) {
        form.reset({
          username: profile.username || "",
          goal: profile.goal || "",
          experience: profile.experience || "",
          injuries: profile.injuries || [],
          equipment: profile.equipment || ["db", "barbell", "bench", "bands", "pullup_bar"],
        })
      }
    } catch (error: any) {
      toast({
        title: "Error loading profile",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to save your profile",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from("users")
        .upsert({
          id: user.id,
          username: data.username,
          email: user.email,
          goal: data.goal || null,
          experience: data.experience || null,
          injuries: data.injuries,
          equipment: data.equipment,
        })

      if (error) throw error

      toast({
        title: "Profile saved",
        description: "Your profile has been updated successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error saving profile",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Profile Settings" showBack={true} />
      <div className="container mx-auto p-4 lg:p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Profile Settings</CardTitle>
              <CardDescription>
                Set up your fitness profile to get personalized workouts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter your username" 
                            {...field} 
                            className="text-base"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="goal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fitness Goal</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="text-base">
                              <SelectValue placeholder="Select your primary goal" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="hypertrophy">Hypertrophy (Muscle Growth)</SelectItem>
                            <SelectItem value="strength">Strength</SelectItem>
                            <SelectItem value="recomposition">Body Recomposition</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="experience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Experience Level</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="text-base">
                              <SelectValue placeholder="Select your experience level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="beginner">Beginner (0-1 years)</SelectItem>
                            <SelectItem value="intermediate">Intermediate (1-3 years)</SelectItem>
                            <SelectItem value="advanced">Advanced (3+ years)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="injuries"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Injuries/Limitations</FormLabel>
                        <FormControl>
                          <MultiSelect
                            options={injuryOptions}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select any injuries or limitations"
                            className="text-base"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="equipment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Available Equipment</FormLabel>
                        <FormControl>
                          <MultiSelect
                            options={equipmentOptions}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select available equipment"
                            className="text-base"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full text-base py-6" 
                    disabled={loading}
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Profile
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Account Management Section */}
          <Card>
            <CardHeader>
              <CardTitle>Account Management</CardTitle>
              <CardDescription>
                Manage your account settings and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              {user && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Email</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={signOut} 
                    variant="destructive" 
                    className="w-full text-base py-6"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}