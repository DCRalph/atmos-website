import Foundation
/** Read only within the App Group; no paths from a share are trusted. */
enum TaskShareStore {
  private static var root: URL? {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.nz.co.atmosmedia.app")?.appendingPathComponent("TaskShares", isDirectory: true)
  }
  static func read() -> String? {
    guard let root, let data = try? Data(contentsOf: root.appendingPathComponent("pending.json")),
      var manifest = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let folder = manifest["folder"] as? String, UUID(uuidString: folder) != nil,
      let createdAt = manifest["createdAt"] as? Double, Date().timeIntervalSince1970 - createdAt < 86400,
      let files = manifest["images"] as? [[String: String]], files.count <= 5 else { clear(); return nil }
    var images: [[String: String]] = []
    for file in files {
      guard let name = file["name"], name.range(of: "^chat-[1-5]\\.jpg$", options: .regularExpression) != nil else { return nil }
      let url = root.appendingPathComponent(folder).appendingPathComponent(name)
      guard FileManager.default.fileExists(atPath: url.path) else { return nil }
      images.append(["uri": url.absoluteString, "name": name, "type": "image/jpeg"])
    }
    manifest["images"] = images
    guard let result = try? JSONSerialization.data(withJSONObject: manifest) else { return nil }
    return String(data: result, encoding: .utf8)
  }
  static func clear() { if let root { try? FileManager.default.removeItem(at: root) } }
}
