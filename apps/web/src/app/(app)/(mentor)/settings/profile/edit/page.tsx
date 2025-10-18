import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getFullProfile } from '~/server/queries/profiles'
import { getMajors, getSchools } from '~/server/queries/reference-data'
import { EditProfileContent } from '../components/EditProfileContent'
import { ProfileShell } from '../components/ProfileShell'

const getEditProfileData = async () => {
  const [profile, schools, majors] = await Promise.all([
    getFullProfile(),
    getSchools(),
    getMajors(),
  ])
  return { profile, schools, majors }
}

const EditProfilePage = async () => {
  await connection()
  const { profile, schools, majors } = await getEditProfileData()

  if (!profile) {
    return <div>User not found</div>
  }

  return (
    <ProfileShell
      title="Edit Profile"
      description="Update your profile information and academic details"
    >
      <EditProfileContent profile={profile} schools={schools} majors={majors} />
    </ProfileShell>
  )
}

export default EditProfilePage

export const metadata: Metadata = {
  title: 'Edit Profile | Discuno',
  description: 'Update your profile information and academic details on Discuno',
}
