Pod::Spec.new do |s|
  s.name           = 'ProximityEducation'
  s.version        = '1.0.0'
  s.summary        = "Apple's Tap to Pay on iPhone merchant education, in-app."
  s.description    = 'Wraps ProximityReaderDiscovery so the app can present ' \
                     "Apple's own How to Tap content, as App Review " \
                     'requirement 4.1 requires on iOS 18 and later.'
  s.author         = 'Atmos Media'
  s.homepage       = 'https://atmosmedia.co.nz'
  s.license        = { :type => 'Proprietary' }
  # ProximityReader is a system framework and needs no entry here; it is already
  # linked by the Stripe Terminal SDK, and weak-linked behind an availability
  # check for the iOS versions that do not have the discovery API.
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
