Pod::Spec.new do |s|
  s.name           = 'RunSheetActivity'
  s.version        = '1.0.0'
  s.summary        = "Tonight's run sheet, on the lock screen."
  s.description    = 'Starts and moves the ActivityKit Live Activity that the ' \
                     'RunSheetWidget extension draws. The widget target is ' \
                     'added to the generated project by ' \
                     'plugins/with-run-sheet-widget.js.'
  s.author         = 'Atmos Media'
  s.homepage       = 'https://atmosmedia.co.nz'
  s.license        = { :type => 'Proprietary' }
  # ActivityKit is a system framework and arrives in iOS 16.1. The floor stays
  # at the app's own so this pod does not raise it for everybody; every call
  # into ActivityKit is behind an availability check instead, and a handset on
  # iOS 15 simply reports the feature as unsupported.
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
