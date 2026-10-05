Pod::Spec.new do |s|
  s.name           = 'AppleWallet'
  s.version        = '1.0.0'
  s.summary        = 'Whether this device can hold an Apple Wallet pass.'
  s.author         = 'Atmos Media'
  s.homepage       = 'https://atmosmedia.co.nz'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'PassKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
