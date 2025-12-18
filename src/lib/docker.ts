import Docker from "dockerode";

const docker =
  process.platform === "linux"
    ? new Docker({ socketPath: "/var/run/docker.sock" })
    : new Docker({ socketPath: "//./pipe/docker_engine" });

export default docker;
