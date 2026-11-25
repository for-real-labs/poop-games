Pod::Spec.new do |s|
  s.name = 'CrosswordHaptics'
  s.version = '1.0.0'
  s.summary = 'Prepared keyboard feedback for Crossword'
  s.homepage = 'https://github.com/for-real-labs/poop-games'
  s.license = 'MIT'
  s.author = 'For Real Labs'
  s.source = { :git => 'https://github.com/for-real-labs/poop-games.git' }
  s.platform = :ios, '16.4'
  s.swift_version = '5.9'
  s.static_framework = true
  s.source_files = '**/*.swift'
  s.dependency 'ExpoModulesCore'
end
